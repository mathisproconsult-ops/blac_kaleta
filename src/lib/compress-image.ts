export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const COMPRESS_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_DIMENSION = 2000;
const QUALITY_STEPS = [0.82, 0.7, 0.55, 0.4];

// Les gifs (animation) et les fichiers non-images (pdf) ne peuvent pas être
// recompressés via un canvas : on les laisse passer tels quels.
function isCompressible(file: File) {
  return file.type.startsWith("image/") && file.type !== "image/gif";
}

export async function compressImageFile(file: File): Promise<File> {
  if (!isCompressible(file) || file.size <= COMPRESS_ABOVE_BYTES) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const quality of QUALITY_STEPS) {
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (!blob) continue;
      if (blob.size < file.size) {
        const newName = `${file.name.replace(/\.[^./]+$/, "")}.webp`;
        return new File([blob], newName, { type: "image/webp" });
      }
    }

    return file;
  } catch {
    // Décodage échoué (format exotique, fichier corrompu...) : on retente
    // l'envoi du fichier d'origine plutôt que de bloquer l'utilisateur.
    return file;
  }
}
