// Script à exécuter UNE FOIS, à la main, pour appliquer la protection
// (filigrane + redimensionnement + copyright) aux photos d'œuvres déjà en
// ligne avant la mise en place de cette fonctionnalité. Les photos ajoutées
// après coup sont protégées automatiquement par le dashboard — ce script ne
// sert qu'au rattrapage ponctuel des anciennes photos.
//
// Prérequis :
//   1. Avoir appliqué les migrations 0028_printify.sql et
//      0029_artwork_protection.sql dans Supabase (SQL Editor).
//   2. Dans Project Settings → API de ton projet Supabase, copier la
//      "service_role key" (PAS la clé anon publique — celle-ci contourne
//      les policies RLS, garde-la secrète, ne la commite jamais).
//
// Utilisation (depuis un dossier vide, avec Node.js 18+) :
//   npm install @supabase/supabase-js sharp
//   SUPABASE_URL="https://xxxx.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="eyJ...." \
//   node reprocess-artwork-images.mjs
//
// Le script est idempotent : relance-le sans risque, il saute les photos
// déjà traitées (original_path déjà renseigné).

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Variables d'environnement manquantes : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --- Reprend exactement le pipeline de src/lib/image-protection.ts ---
const MAX_DIMENSION = 1200;
const WATERMARK_LABEL = "Blac_Kaleta · blac-kaleta.com";

function buildWatermarkSvg(width, height) {
  const fontSize = Math.max(16, Math.round(Math.min(width, height) * 0.045));
  const cellWidth = fontSize * WATERMARK_LABEL.length * 0.62;
  const cellHeight = fontSize * 3.2;

  const diagonal = Math.ceil(Math.sqrt(width * width + height * height));
  const cols = Math.ceil(diagonal / cellWidth) + 2;
  const rows = Math.ceil(diagonal / cellHeight) + 2;

  const tiles = [];
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

async function protectArtworkImage(input) {
  const rotated = sharp(input).rotate();
  const metadata = await rotated.metadata();
  const width = metadata.width ?? MAX_DIMENSION;
  const height = metadata.height ?? MAX_DIMENSION;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  // Redimensionne d'abord, puis relit les dimensions RÉELLES du résultat —
  // l'arrondi interne de sharp pour fit:"inside" peut différer de notre
  // calcul de 1px, et .composite() rejette un filigrane ne serait-ce qu'un
  // pixel plus grand que l'image de base.
  const resizedBuffer = await rotated
    .resize({ width: targetWidth, height: targetHeight, fit: "inside", withoutEnlargement: true })
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
// --- fin du pipeline partagé ---

// Une URL publique Supabase Storage a la forme
// https://xxxx.supabase.co/storage/v1/object/public/{bucket}/{path...} —
// les anciennes photos peuvent être dans "products" (tout premier bucket)
// ou "media" (bucket utilisé depuis) selon leur ancienneté.
function parseBucketAndPath(url) {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

async function main() {
  const { data: rows, error } = await supabase
    .from("product_images")
    .select("id, product_id, path, url, original_path, products(source)")
    .is("original_path", null)
    .order("id", { ascending: true });

  if (error) {
    console.error("Impossible de lister les photos :", error.message);
    process.exit(1);
  }

  const toProcess = (rows ?? []).filter((row) => row.products?.source !== "printify");
  console.log(`${toProcess.length} photo(s) à traiter (Printify exclu, déjà traitées exclues).`);

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of toProcess) {
    const label = `#${row.id} (produit ${row.product_id})`;
    const located = parseBucketAndPath(row.url);
    if (!located) {
      console.warn(`${label} : URL non reconnue, ignorée — ${row.url}`);
      skipped += 1;
      continue;
    }

    if (located.path.toLowerCase().endsWith(".gif")) {
      console.log(`${label} : GIF animé, ignoré (non retraité, comme les nouveaux GIFs).`);
      skipped += 1;
      continue;
    }

    try {
      const { data: downloaded, error: downloadError } = await supabase.storage
        .from(located.bucket)
        .download(located.path);
      if (downloadError || !downloaded) {
        throw new Error(downloadError?.message ?? "téléchargement vide");
      }
      const originalBuffer = Buffer.from(await downloaded.arrayBuffer());

      const protectedImage = await protectArtworkImage(originalBuffer);
      const destPath = `${row.product_id}/${row.id}-${Date.now()}.${protectedImage.extension}`;

      const { error: originalUploadError } = await supabase.storage
        .from("artwork-originals")
        .upload(destPath, originalBuffer, { contentType: "image/*", upsert: true });
      if (originalUploadError) throw new Error(`original : ${originalUploadError.message}`);

      const { error: publicUploadError } = await supabase.storage
        .from("products")
        .upload(destPath, protectedImage.buffer, {
          contentType: protectedImage.contentType,
          upsert: true,
        });
      if (publicUploadError) throw new Error(`public : ${publicUploadError.message}`);

      const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(destPath);

      const { error: updateError } = await supabase
        .from("product_images")
        .update({ path: destPath, url: publicUrlData.publicUrl, original_path: destPath })
        .eq("id", row.id);
      if (updateError) throw new Error(`mise à jour : ${updateError.message}`);

      console.log(`${label} : ok.`);
      done += 1;
    } catch (err) {
      console.error(`${label} : échec — ${err instanceof Error ? err.message : err}`);
      failed += 1;
    }
  }

  console.log(`\nTerminé — ${done} traitée(s), ${skipped} ignorée(s), ${failed} échec(s).`);
  if (failed > 0) {
    console.log("Relance le script : il reprendra uniquement les photos encore en échec.");
  }
}

main();
