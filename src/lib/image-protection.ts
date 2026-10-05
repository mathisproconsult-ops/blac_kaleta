import sharp from "sharp";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { WATERMARK_FONTS, type WatermarkFontKey } from "./fonts/watermark-fonts";
import { getSettings, type WatermarkColor, type WatermarkPosition } from "./settings";

// Toutes les images d'œuvres servies publiquement passent par ce pipeline :
// redimensionnement (inexploitable en impression), filigrane visible, et
// métadonnées de copyright. L'original envoyé par l'admin n'est jamais
// modifié — seule cette copie dérivée est rendue publique (voir
// products/actions.ts : l'original part tel quel vers le bucket privé
// artwork-originals, cette fonction ne touche qu'à la copie publique).

const MAX_DIMENSION = 1200;
// Taille de sortie pour les vignettes de grille (Boutique, Œuvres
// récentes) : bien plus légère que les copies pleine résolution, servie à
// la place de celles-ci partout où l'image n'est affichée qu'en petit.
// 720px (plutôt que 480px avant) : sur un écran rétina (2x), une vignette
// affichée à ~250-360px CSS dans la grille responsive du site (1 à 3
// colonnes selon la largeur d'écran) a besoin d'environ 500-720px natifs
// pour rester nette — 480px était trop juste pour les grandes tuiles
// desktop et le plein écran mobile.
export const THUMBNAIL_MAX_DIMENSION = 720;
const DEFAULT_QUALITY = 82;

const WATERMARK_FONT_FAMILY_PREFIX = "Blac Kaleta Watermark ";
// Couleurs du filigrane en mode "auto" (par défaut), selon la luminosité
// du coin de l'image où il se pose (voir sampleCornerBrightness) : clair
// sur fond sombre, sombre sur fond clair, pour ne jamais devenir invisible
// selon la photo. Les modes "blanc"/"noir" (réglables dans Paramètres)
// utilisent toujours la même paire, quel que soit le fond.
const WATERMARK_COLOR_ON_DARK = { fill: "#ffffff", stroke: "#000000" };
const WATERMARK_COLOR_ON_LIGHT = { fill: "#1a1a1a", stroke: "#ffffff" };

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Le filigrane était rendu avec une police système (Helvetica/Arial/
// sans-serif) : sur un serveur sans aucune police installée (le cas de
// l'environnement d'exécution utilisé en production), librsvg/pango n'a
// aucun glyphe à dessiner et affiche un petit carré vide à la place de
// chaque caractère — bug reproduit et vérifié en local en vidant
// complètement fontconfig. Polices embarquées (voir fonts/watermark-fonts.ts,
// licence SIL OFL) pour un rendu identique quel que soit le serveur.
//
// Un @font-face avec police encodée en base64 directement dans le SVG a
// été essayé en premier mais échoue exactement pareil dès que fontconfig
// ne trouve aucune police système : le rendu passe par pango, qui route la
// résolution de police — même pour un @font-face embarqué — par
// fontconfig. La police doit donc être enregistrée auprès de fontconfig
// lui-même pour être trouvée, quoi qu'il arrive. Solution vérifiée : écrire
// le fichier de police dans /tmp au premier besoin, avec un fonts.conf
// minimal qui pointe dessus — fontconfig sait scanner un dossier à la
// volée, sans cache pré-généré.
//
// IMPORTANT, découvert en testant plusieurs polices dans le même process :
// fontconfig/pango initialisent et mettent en cache leur base de polices en
// mémoire native à la toute première utilisation — changer
// process.env.FONTCONFIG_FILE APRÈS cette première utilisation n'a alors
// plus aucun effet (vérifié : la deuxième police demandée se rendait
// silencieusement avec la police de la première, jamais la sienne). Les
// TROIS polices doivent donc être enregistrées en un seul passage, dans un
// unique fonts.conf combiné écrit AVANT le tout premier rendu SVG du
// process — jamais une police à la fois au fil des appels.
let fontsRegistered = false;
function ensureWatermarkFontsRegistered(): void {
  if (fontsRegistered) return;
  try {
    const entries: { dir: string; fontPath: string; fontFamily: string }[] = [];

    for (const fontKey of Object.keys(WATERMARK_FONTS) as WatermarkFontKey[]) {
      const font = WATERMARK_FONTS[fontKey];
      const fontFamily = WATERMARK_FONT_FAMILY_PREFIX + fontKey;
      // Le dossier est nommé d'après un hash du contenu de la police
      // plutôt qu'un nom fixe par clé : un process serveur assez longtemps
      // vivant pour avoir déjà écrit une ancienne version de cette police
      // au même chemin fixe aurait sinon gardé ce fichier périmé
      // indéfiniment après un changement de contenu (le check
      // !existsSync ci-dessous ne regarde que la présence du fichier,
      // jamais son contenu) — repéré en testant un changement de police
      // dans ce même environnement.
      const fontHash = createHash("sha256").update(font.base64).digest("hex").slice(0, 16);
      const dir = join(tmpdir(), `blac-kaleta-watermark-font-${fontKey}-${fontHash}`);
      const fontPath = join(dir, "watermark.ttf");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      if (!existsSync(fontPath)) {
        writeFileSync(fontPath, Buffer.from(font.base64, "base64"));
      }
      entries.push({ dir, fontPath, fontFamily });
    }

    // Un seul fonts.conf combiné, qui liste les trois dossiers et force le
    // nom de famille de chaque police d'après le fichier scanné plutôt que
    // de dépendre de son nom interne — le SVG référence ces noms fixes,
    // indépendants des fichiers de police réellement utilisés.
    const combinedDir = join(tmpdir(), "blac-kaleta-watermark-fonts-combined");
    const cacheDir = join(combinedDir, "fc-cache");
    if (!existsSync(combinedDir)) mkdirSync(combinedDir, { recursive: true });
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    const confPath = join(combinedDir, "fonts.conf");
    const dirEntries = entries.map((f) => `  <dir>${f.dir}</dir>`).join("\n");
    const matchEntries = entries
      .map(
        (f) =>
          `  <match target="scan">\n    <test name="file"><string>${f.fontPath}</string></test>\n    <edit name="family" mode="assign"><string>${f.fontFamily}</string></edit>\n  </match>`,
      )
      .join("\n");
    writeFileSync(
      confPath,
      `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n${dirEntries}\n  <cachedir>${cacheDir}</cachedir>\n${matchEntries}\n</fontconfig>\n`,
    );

    process.env.FONTCONFIG_FILE = confPath;
    fontsRegistered = true;
  } catch (err) {
    // Best-effort : si /tmp n'est pas accessible en écriture pour une
    // raison quelconque, on retombe sur la résolution système normale
    // (le comportement d'avant ce correctif) plutôt que de faire planter
    // tout le traitement d'image.
    console.error("ensureWatermarkFontsRegistered", err);
  }
}

// Échantillonne le coin où se pose le filigrane (plus généreux que la zone
// de texte réelle, pour rester fiable quelle que soit la largeur du texte)
// et renvoie sa luminosité moyenne (0 = noir, 255 = blanc) — sert à choisir
// une couleur de filigrane qui reste visible quel que soit le fond de la
// photo à cet endroit précis, plutôt qu'une couleur fixe qui peut devenir
// quasi invisible sur un fond de la même teinte. Utilisé uniquement en
// mode couleur "auto".
async function sampleCornerBrightness(
  buffer: Buffer,
  width: number,
  height: number,
  position: WatermarkPosition,
): Promise<number> {
  try {
    const sampleWidth = Math.max(1, Math.min(width, Math.round(width * 0.3)));
    const sampleHeight = Math.max(1, Math.min(height, Math.round(height * 0.18)));
    let left = Math.max(0, width - sampleWidth);
    let top = Math.max(0, height - sampleHeight);
    if (position === "haut-gauche" || position === "haut-droite") top = 0;
    if (position === "haut-gauche" || position === "bas-gauche") left = 0;
    if (position === "centre") {
      left = Math.max(0, Math.round((width - sampleWidth) / 2));
      top = Math.max(0, Math.round((height - sampleHeight) / 2));
    }
    const { data } = await sharp(buffer)
      .extract({ left, top, width: sampleWidth, height: sampleHeight })
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (data.length === 0) return 128;
    let sum = 0;
    for (const value of data) sum += value;
    return sum / data.length;
  } catch (err) {
    // Best-effort : une image illisible pour l'extraction (ex. format
    // exotique) ne doit pas faire échouer tout le filigranage — retombe sur
    // une luminosité moyenne, qui choisit les couleurs actuelles par défaut.
    console.error("sampleCornerBrightness", err);
    return 128;
  }
}

export type WatermarkRenderSettings = {
  text: string;
  position: WatermarkPosition;
  font: WatermarkFontKey;
  // Pourcentage de la LARGEUR de l'image (pas du plus petit côté) : un
  // même pourcentage donne un rendu cohérent entre la vignette, la copie
  // principale et la copie haute qualité, quel que soit leur ratio
  // largeur/hauteur respectif.
  sizePercent: number;
  // 0-100.
  opacity: number;
  color: WatermarkColor;
};

function buildWatermarkSvg(
  width: number,
  height: number,
  lightBackground: boolean,
  settings: WatermarkRenderSettings,
): Buffer {
  ensureWatermarkFontsRegistered();
  const fontFamily = WATERMARK_FONT_FAMILY_PREFIX + settings.font;
  const label = escapeXml(settings.text.trim() || "Blac_Kaleta");
  const fontSize = Math.max(10, Math.round(width * (settings.sizePercent / 100)));
  const fillOpacity = Math.max(0, Math.min(100, settings.opacity)) / 100;
  // Le contour reste toujours plus discret que le texte lui-même, à
  // n'importe quel niveau d'opacité choisi — garde la lisibilité sans
  // jamais dominer le rendu.
  const strokeOpacity = fillOpacity * 0.4;

  let fill: string;
  let stroke: string;
  if (settings.color === "blanc") {
    ({ fill, stroke } = WATERMARK_COLOR_ON_DARK);
  } else if (settings.color === "noir") {
    ({ fill, stroke } = WATERMARK_COLOR_ON_LIGHT);
  } else {
    ({ fill, stroke } = lightBackground ? WATERMARK_COLOR_ON_LIGHT : WATERMARK_COLOR_ON_DARK);
  }

  if (settings.position === "diagonale") {
    // Motif répété en diagonale sur toute l'image (pas une seule
    // instance) : un recadrage ne peut pas retirer le filigrane sans
    // mutiler l'œuvre — option plus protectrice mais plus chargée
    // visuellement, au choix dans Paramètres.
    const cellWidth = fontSize * label.length * 0.62;
    const cellHeight = fontSize * 3.2;
    const diagonal = Math.ceil(Math.sqrt(width * width + height * height));
    const cols = Math.ceil(diagonal / cellWidth) + 2;
    const rows = Math.ceil(diagonal / cellHeight) + 2;

    const tiles: string[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = col * cellWidth - diagonal / 2;
        const y = row * cellHeight - diagonal / 2;
        tiles.push(
          `<text x="${x}" y="${y}" font-size="${fontSize}" font-weight="700" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="0.6">${label}</text>`,
        );
      }
    }

    return Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(${width / 2} ${height / 2}) rotate(-30)" text-anchor="middle" font-family="${fontFamily}">
          ${tiles.join("\n")}
        </g>
      </svg>
    `);
  }

  const margin = Math.round(fontSize * 0.7);
  let x: number;
  let y: number;
  let anchor: "start" | "middle" | "end";
  switch (settings.position) {
    case "haut-gauche":
      x = margin;
      y = margin + fontSize * 0.8;
      anchor = "start";
      break;
    case "haut-droite":
      x = width - margin;
      y = margin + fontSize * 0.8;
      anchor = "end";
      break;
    case "bas-gauche":
      x = margin;
      y = height - margin;
      anchor = "start";
      break;
    case "centre":
      x = width / 2;
      y = height / 2 + fontSize * 0.3;
      anchor = "middle";
      break;
    case "bas-droite":
    default:
      x = width - margin;
      y = height - margin;
      anchor = "end";
      break;
  }

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="700" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="0.8">${label}</text>
    </svg>
  `);
}

export type ProtectedImage = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  // Dimensions réelles de l'image produite : permettent de réserver le bon
  // espace côté navigateur avant même que l'image ne soit chargée (attributs
  // width/height sur <img>), pour éviter un décalage visuel (CLS) quand
  // l'image apparaît — en particulier dans la bannière défilante d'accueil,
  // où chaque vignette a une largeur intrinsèque différente.
  width: number;
  height: number;
};

async function resizeForProtection(
  input: Buffer,
  maxDimension: number,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const rotated = sharp(input).rotate(); // applique l'orientation EXIF puis la retire
  const metadata = await rotated.metadata();
  const width = metadata.width ?? maxDimension;
  const height = metadata.height ?? maxDimension;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  // Math.max(1, ...) : pour un ratio très extrême (ex. 1×5000, une vignette
  // à 480px), l'arrondi peut tomber à 0 sur le petit côté — sharp exige un
  // entier strictement positif.
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  // Redimensionne d'abord, puis relit les dimensions RÉELLES du résultat —
  // l'arrondi interne de sharp pour fit:"inside" peut différer de notre
  // calcul de 1px, et .composite() rejette un filigrane ne serait-ce qu'un
  // pixel plus grand que l'image de base ("Image to composite must have
  // same dimensions or smaller").
  const resizedBuffer = await rotated
    .resize({ width: targetWidth, height: targetHeight, fit: "inside", withoutEnlargement: true })
    .toBuffer();

  const resizedMetadata = await sharp(resizedBuffer).metadata();
  return {
    buffer: resizedBuffer,
    width: resizedMetadata.width ?? targetWidth,
    height: resizedMetadata.height ?? targetHeight,
  };
}

async function compositeWatermark(
  resizedBuffer: Buffer,
  actualWidth: number,
  actualHeight: number,
  settings: WatermarkRenderSettings,
): Promise<Buffer> {
  const lightBackground =
    settings.color === "auto"
      ? (await sampleCornerBrightness(resizedBuffer, actualWidth, actualHeight, settings.position)) > 150
      : false;
  return sharp(resizedBuffer)
    .composite([{ input: buildWatermarkSvg(actualWidth, actualHeight, lightBackground, settings) }])
    .toBuffer();
}

// Prend les octets tels qu'envoyés par l'admin et produit une copie
// destinée au site public : redimensionnée, filigranée (sauf si désactivé
// dans Paramètres), avec métadonnées de copyright. maxDimension/quality
// permettent de produire la vignette de grille, la copie principale, ou la
// copie haute qualité (fiche produit + lightbox) en réutilisant le même
// pipeline, juste à une taille/qualité de sortie différente — voir
// THUMBNAIL_MAX_DIMENSION et les réglages "Qualité des images" dans
// Paramètres pour la copie haute qualité.
export async function protectArtworkImage(
  input: Buffer,
  maxDimension: number = MAX_DIMENSION,
  quality: number = DEFAULT_QUALITY,
): Promise<ProtectedImage> {
  const settings = await getSettings();
  const { buffer: resizedBuffer, width: actualWidth, height: actualHeight } = await resizeForProtection(
    input,
    maxDimension,
  );

  const withWatermark = settings.watermark_enabled
    ? await compositeWatermark(resizedBuffer, actualWidth, actualHeight, {
        text: settings.watermark_text,
        position: settings.watermark_position,
        font: settings.watermark_font,
        sizePercent: settings.watermark_size_percent,
        opacity: settings.watermark_opacity,
        color: settings.watermark_color,
      })
    : resizedBuffer;

  const buffer = await sharp(withWatermark)
    .withExifMerge({
      IFD0: {
        Artist: "Blac_Kaleta",
        Copyright: "© Blac_Kaleta, tous droits réservés",
        ImageDescription: "https://blac-kaleta.com",
      },
    })
    .webp({ quality })
    .toBuffer();

  return { buffer, contentType: "image/webp", extension: "webp", width: actualWidth, height: actualHeight };
}

// Variante de protectArtworkImage pour l'aperçu en direct dans Paramètres →
// Filigrane : utilise des réglages de FILIGRANE pas encore enregistrés
// (ceux en cours de modification dans le formulaire), plutôt que de relire
// la base — sinon l'aperçu ne refléterait jamais ce que l'admin est en
// train de choisir avant d'avoir cliqué sur Enregistrer. Resize/qualité
// restent ceux de la copie principale, l'aperçu n'a pas besoin de haute
// résolution.
export async function previewWatermark(
  input: Buffer,
  draftSettings: WatermarkRenderSettings,
  enabled: boolean,
): Promise<ProtectedImage> {
  const { buffer: resizedBuffer, width: actualWidth, height: actualHeight } = await resizeForProtection(
    input,
    MAX_DIMENSION,
  );

  const withWatermark = enabled
    ? await compositeWatermark(resizedBuffer, actualWidth, actualHeight, draftSettings)
    : resizedBuffer;

  const buffer = await sharp(withWatermark).webp({ quality: DEFAULT_QUALITY }).toBuffer();
  return { buffer, contentType: "image/webp", extension: "webp", width: actualWidth, height: actualHeight };
}

const BLUR_TINY_DIMENSION = 24;
const BLUR_OUTPUT_DIMENSION = 600;
const BLUR_SIGMA = 12;

// Aperçu flouté servi par défaut pour le contenu +18 tant que l'âge n'est
// pas vérifié. Contrairement à un flou CSS (appliqué côté navigateur sur
// l'image pleine résolution — contournable en inspectant le code pour
// récupérer l'URL d'origine, et partiellement réversible par
// déconvolution), l'information est ici réellement détruite : l'image est
// d'abord réduite à une résolution minuscule (24px), puis floutée — remonter
// en résolution ensuite ne peut pas restituer un détail qui n'existe plus
// dans les pixels sources.
export async function blurArtworkImage(input: Buffer): Promise<ProtectedImage> {
  const rotated = sharp(input).rotate();
  const metadata = await rotated.metadata();
  const width = metadata.width ?? BLUR_OUTPUT_DIMENSION;
  const height = metadata.height ?? BLUR_OUTPUT_DIMENSION;

  // .normalize() étire le contraste de la minuscule vignette sur toute la
  // plage de luminosité disponible : sans ça, une œuvre déjà très sombre ou
  // peu contrastée (fusain, encre...) pouvait s'écraser en un aplat quasi
  // uniforme une fois réduite à 24px puis floutée — un rectangle
  // pratiquement noir plutôt qu'un flou reconnaissable comme tel.
  const tinyBuffer = await rotated
    .resize({
      width: BLUR_TINY_DIMENSION,
      height: BLUR_TINY_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .normalize()
    .toBuffer();

  const scale = Math.min(1, BLUR_OUTPUT_DIMENSION / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const buffer = await sharp(tinyBuffer)
    .resize({ width: targetWidth, height: targetHeight, fit: "fill" })
    .blur(BLUR_SIGMA)
    .webp({ quality: 60 })
    .toBuffer();

  return { buffer, contentType: "image/webp", extension: "webp", width: targetWidth, height: targetHeight };
}

const DECOR_MAX_DIMENSION = 1600;

// Pour les images "de décor" (logo, couvertures de catégories, images de
// popup, images de pages personnalisées) : ni filigrane ni métadonnées
// d'œuvre, juste un redimensionnement raisonnable et une compression WebP
// — ces images sont uploadées telles quelles par l'admin (parfois
// plusieurs Mo, directement depuis un téléphone) alors qu'elles ne sont
// jamais affichées à plus de quelques centaines de pixels de large.
export async function optimizeDecorImage(input: Buffer): Promise<ProtectedImage> {
  const rotated = sharp(input).rotate();
  const metadata = await rotated.metadata();
  const width = metadata.width ?? DECOR_MAX_DIMENSION;
  const height = metadata.height ?? DECOR_MAX_DIMENSION;
  const scale = Math.min(1, DECOR_MAX_DIMENSION / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const resizedBuffer = await rotated
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();

  // fit:"inside" peut arrondir différemment de notre calcul de 1px : on
  // relit les dimensions réelles plutôt que de supposer qu'elles valent
  // targetWidth/targetHeight.
  const resizedMetadata = await sharp(resizedBuffer).metadata();
  const actualWidth = resizedMetadata.width ?? targetWidth;
  const actualHeight = resizedMetadata.height ?? targetHeight;

  const buffer = await sharp(resizedBuffer).webp({ quality: 82 }).toBuffer();

  return { buffer, contentType: "image/webp", extension: "webp", width: actualWidth, height: actualHeight };
}
