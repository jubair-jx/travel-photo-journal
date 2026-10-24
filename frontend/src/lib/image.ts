const MAX_SIDE = 1024;
const QUALITY = 0.8;

// A small JPEG copy of a photo, for sending to the AI description service. The original is
// untouched; this only keeps the upload (and what the model has to read) small and cheap.
export async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", QUALITY);
    });
    if (!blob) throw new Error("Could not resize the image");
    return new File([blob], "preview.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
