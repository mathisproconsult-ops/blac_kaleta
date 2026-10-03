import sharp from "sharp";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { WATERMARK_FONT_BASE64 } from "./fonts/watermark-font";

// Toutes les images d'œuvres servies publiquement passent par ce pipeline :
// redimensionnement (inexploitable en impression), filigrane visible, et
// métadonnées de copyright. L'original envoyé par l'admin n'est jamais
// modifié — seule cette copie dérivée est rendue publique (voir
// products/actions.ts : l'original part tel quel vers le bucket privé
// artwork-originals, cette fonction ne touche qu'à la copie publique).

const MAX_DIMENSION = 1200;
// Taille de sortie pour les vignettes de grille (Boutique, Œuvres
// récentes) : bien plus légère que la copie pleine résolution, servie à
// la place de celle-ci partout où l'image n'est affichée qu'en petit.
export const THUMBNAIL_MAX_DIMENSION = 480;
const WATERMARK_LABEL = "Blac_Kaleta";
const WATERMARK_FONT_FAMILY = "Blac Kaleta Watermark";
// Couleurs du filigrane selon la luminosité du coin de l'image où il se
// pose (voir sampleCornerBrightness) : clair sur fond sombre, sombre sur
// fond clair, pour ne jamais devenir invisible selon la photo.
const WATERMARK_COLOR_ON_DARK = { fill: "#ffffff", stroke: "#000000" };
const WATERMARK_COLOR_ON_LIGHT = { fill: "#1a1a1a", stroke: "#ffffff" };

// Le filigrane était rendu avec une police système (Helvetica/Arial/
// sans-serif) : sur un serveur sans aucune police installée (le cas de
// l'environnement d'exécution utilisé en production), librsvg/pango n'a
// aucun glyphe à dessiner et affiche un petit carré vide à la place de
// chaque caractère — le bug remonté sur certaines photos, reproduit et
// vérifié en local en vidant complètement fontconfig. Police actuelle :
// Caveat (effet signature manuscrite), extraite du paquet npm
// @fontsource/caveat (licence SIL OFL, voir fonts/LICENSE.txt) et
// convertie de WOFF2 vers TTF.
//
// Un @font-face avec police encodée en base64 directement dans le SVG a
// été essayé en premier mais échoue exactement pareil dès que fontconfig
// ne trouve aucune police système : le rendu passe par pango, qui route la
// résolution de police — même pour un @font-face embarqué — par
// fontconfig. La police doit donc être enregistrée auprès de fontconfig
// lui-même pour être trouvée, quoi qu'il arrive. Solution vérifiée : écrire
// le fichier de police (déjà embarqué en base64 dans le bundle, voir
// ./fonts/watermark-font.ts) dans /tmp au premier démarrage, avec un
// fonts.conf minimal qui pointe dessus — fontconfig sait scanner un
// dossier à la volée, sans cache pré-généré. Fait une seule fois par
// instance (le fichier n'est réécrit que s'il est absent).
let fontconfigReady = false;
function ensureWatermarkFontRegistered(): void {
  if (fontconfigReady) return;
  try {
    // Le dossier est nommé d'après un hash du contenu de la police plutôt
    // qu'un nom fixe : un process serveur assez longtemps vivant pour avoir
    // déjà écrit l'ancienne police à ce chemin fixe aurait sinon gardé ce
    // fichier périmé indéfiniment après un changement de police (le check
    // !existsSync ci-dessous ne regarde que la présence du fichier, jamais
    // son contenu) — repéré en testant le passage à Caveat dans ce même
    // environnement : l'ancien fichier DejaVu était toujours là. Un hash
    // différent à chaque changement de contenu donne un nouveau chemin,
    // donc une écriture fraîche garantie, sans perdre l'intérêt du cache
    // (les appels répétés avec la même police réutilisent le même chemin).
    const fontHash = createHash("sha256").update(WATERMARK_FONT_BASE64).digest("hex").slice(0, 16);
    const dir = join(tmpdir(), `blac-kaleta-watermark-font-${fontHash}`);
    const fontPath = join(dir, "watermark.ttf");
    const cacheDir = join(dir, "fc-cache");
    const confPath = join(dir, "fonts.conf");

    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    if (!existsSync(fontPath)) {
      writeFileSync(fontPath, Buffer.from(WATERMARK_FONT_BASE64, "base64"));
    }
    if (!existsSync(confPath)) {
      // Le <match> force le nom de famille à WATERMARK_FONT_FAMILY plutôt
      // que de dépendre du nom interne du fichier .ttf (actuellement
      // "Caveat") — le SVG référence ce nom fixe, indépendant du fichier de
      // police réellement utilisé.
      writeFileSync(
        confPath,
        `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n  <dir>${dir}</dir>\n  <cachedir>${cacheDir}</cachedir>\n  <match target="scan">\n    <test name="file"><string>${fontPath}</string></test>\n    <edit name="family" mode="assign"><string>${WATERMARK_FONT_FAMILY}</string></edit>\n  </match>\n</fontconfig>\n`,
      );
    }

    process.env.FONTCONFIG_FILE = confPath;
    fontconfigReady = true;
  } catch (err) {
    // Best-effort : si /tmp n'est pas accessible en écriture pour une
    // raison quelconque, on retombe sur la résolution système normale
    // (le comportement d'avant ce correctif) plutôt que de faire planter
    // tout le traitement d'image.
    console.error("ensureWatermarkFontRegistered", err);
  }
}

// Échantillonne le coin où se pose le filigrane (plus généreux que la zone
// de texte réelle, pour rester fiable quelle que soit la largeur du texte)
// et renvoie sa luminosité moyenne (0 = noir, 255 = blanc) — sert à choisir
// une couleur de filigrane qui reste visible quel que soit le fond de la
// photo à cet endroit précis, plutôt qu'une couleur fixe qui peut devenir
// quasi invisible sur un fond de la même teinte.
async function sampleCornerBrightness(buffer: Buffer, width: number, height: number): Promise<number> {
  try {
    const sampleWidth = Math.max(1, Math.min(width, Math.round(width * 0.3)));
    const sampleHeight = Math.max(1, Math.min(height, Math.round(height * 0.18)));
    const left = Math.max(0, width - sampleWidth);
    const top = Math.max(0, height - sampleHeight);
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

function buildWatermarkSvg(width: number, height: number, lightBackground: boolean): Buffer {
  ensureWatermarkFontRegistered();
  // Une seule occurrence, en bas à droite (plutôt que le motif répété en
  // diagonale sur toute l'image utilisé avant) : moins protecteur contre un
  // recadrage agressif, mais c'est le compromis demandé pour ne plus gêner
  // la lecture de l'œuvre.
  const fontSize = Math.max(16, Math.round(Math.min(width, height) * 0.045));
  const margin = Math.round(fontSize * 0.7);
  const x = width - margin;
  const y = height - margin;
  const { fill, stroke } = lightBackground ? WATERMARK_COLOR_ON_LIGHT : WATERMARK_COLOR_ON_DARK;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${x}" y="${y}" text-anchor="end" font-family="${WATERMARK_FONT_FAMILY}" font-size="${fontSize}" font-weight="700" fill="${fill}" fill-opacity="0.85" stroke="${stroke}" stroke-opacity="0.3" stroke-width="0.8">${WATERMARK_LABEL}</text>
    </svg>
  `;

  return Buffer.from(svg);
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

// Prend les octets tels qu'envoyés par l'admin et produit la copie
// destinée au site public : redimensionnée (par défaut max 1200px sur le
// grand côté — inexploitable pour une impression de qualité, sans perte
// visible à l'écran), filigranée, avec métadonnées de copyright.
// maxDimension permet de produire une vignette plus légère pour les
// grilles (voir createThumbnail plus bas) en réutilisant le même pipeline
// de redimensionnement/filigrane, juste à une taille de sortie différente.
export async function protectArtworkImage(
  input: Buffer,
  maxDimension: number = MAX_DIMENSION,
): Promise<ProtectedImage> {
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
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();

  const resizedMetadata = await sharp(resizedBuffer).metadata();
  const actualWidth = resizedMetadata.width ?? targetWidth;
  const actualHeight = resizedMetadata.height ?? targetHeight;

  const cornerBrightness = await sampleCornerBrightness(resizedBuffer, actualWidth, actualHeight);
  const lightBackground = cornerBrightness > 150;

  const buffer = await sharp(resizedBuffer)
    .composite([{ input: buildWatermarkSvg(actualWidth, actualHeight, lightBackground) }])
    .withExifMerge({
      IFD0: {
        Artist: "Blac_Kaleta",
        Copyright: "© Blac_Kaleta, tous droits réservés",
        ImageDescription: "https://blac-kaleta.com",
      },
    })
    .webp({ quality: 82 })
    .toBuffer();

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
