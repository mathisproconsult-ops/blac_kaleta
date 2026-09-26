import sharp from "sharp";

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
const WATERMARK_LABEL = "Blac_Kaleta · blac-kaleta.com";

function buildWatermarkSvg(width: number, height: number): Buffer {
  // Motif répété en diagonale sur toute l'image (pas une seule instance
  // centrée) : un recadrage ne peut pas retirer le filigrane sans mutiler
  // l'œuvre. Opacité faible pour rester discret.
  const fontSize = Math.max(16, Math.round(Math.min(width, height) * 0.045));
  const cellWidth = fontSize * WATERMARK_LABEL.length * 0.62;
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
        `<text x="${x}" y="${y}" font-size="${fontSize}" font-weight="600" fill="#ffffff" fill-opacity="0.22" stroke="#000000" stroke-opacity="0.12" stroke-width="0.6">${WATERMARK_LABEL}</text>`,
      );
    }
  }

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${width / 2} ${height / 2}) rotate(-30)" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">
        ${tiles.join("\n")}
      </g>
    </svg>
  `;

  return Buffer.from(svg);
}

export type ProtectedImage = {
  buffer: Buffer;
  contentType: string;
  extension: string;
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

  const buffer = await sharp(resizedBuffer)
    .composite([{ input: buildWatermarkSvg(actualWidth, actualHeight) }])
    .withExifMerge({
      IFD0: {
        Artist: "Blac_Kaleta",
        Copyright: "© Blac_Kaleta, tous droits réservés",
        ImageDescription: "https://blac-kaleta.com",
      },
    })
    .webp({ quality: 82 })
    .toBuffer();

  return { buffer, contentType: "image/webp", extension: "webp" };
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

  return { buffer, contentType: "image/webp", extension: "webp" };
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

  const buffer = await rotated
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

  return { buffer, contentType: "image/webp", extension: "webp" };
}
