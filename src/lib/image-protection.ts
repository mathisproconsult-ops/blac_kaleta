import sharp from "sharp";

// Toutes les images d'œuvres servies publiquement passent par ce pipeline :
// redimensionnement (inexploitable en impression), filigrane visible, et
// métadonnées de copyright. L'original envoyé par l'admin n'est jamais
// modifié — seule cette copie dérivée est rendue publique (voir
// products/actions.ts : l'original part tel quel vers le bucket privé
// artwork-originals, cette fonction ne touche qu'à la copie publique).

const MAX_DIMENSION = 1200;
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
// destinée au site public : redimensionnée (max 1200px sur le grand
// côté — inexploitable pour une impression de qualité, sans perte
// visible à l'écran), filigranée, avec métadonnées de copyright.
export async function protectArtworkImage(input: Buffer): Promise<ProtectedImage> {
  const rotated = sharp(input).rotate(); // applique l'orientation EXIF puis la retire
  const metadata = await rotated.metadata();
  const width = metadata.width ?? MAX_DIMENSION;
  const height = metadata.height ?? MAX_DIMENSION;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const buffer = await rotated
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .composite([{ input: buildWatermarkSvg(targetWidth, targetHeight) }])
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
