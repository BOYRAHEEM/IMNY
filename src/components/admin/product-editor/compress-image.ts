import { ACCEPTED_IMAGE_TYPES, MAX_SOURCE_IMAGE_BYTES, MAX_UPLOAD_BYTES } from "@/lib/images";

export type PreparedImage = { blob: Blob; width: number; height: number; ext: "webp" | "jpg" };

export class ImageRejected extends Error {}

const MAX_EDGE = 2400; // plenty for zoomable product photos on retina screens

/**
 * Validate and shrink a photo in the browser before upload. Phone photos are
 * often 5-15 MB; this typically brings them to 300-900 KB, which makes
 * uploading over mobile data practical.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    throw new ImageRejected(
      `${file.name}: HEIC photos aren't supported here. On iPhone, choose the photo from the Photos picker (it converts automatically) or set Camera → Formats → Most Compatible.`,
    );
  }
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ImageRejected(`${file.name}: use a JPG, PNG, WebP or AVIF image.`);
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new ImageRejected(`${file.name} is larger than 25 MB.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageRejected(`${file.name} couldn't be read. It may be damaged.`);
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  if (width < 300 || height < 300) {
    bitmap.close();
    throw new ImageRejected(`${file.name} is too small. Use a photo at least 300 × 300 pixels.`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageRejected("Your browser couldn't process this image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.86, 0.75, 0.6]) {
    // Prefer WebP; some older Safari versions silently fall back to PNG, so check.
    let blob = await toBlob(canvas, "image/webp", quality);
    let ext: "webp" | "jpg" = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await toBlob(canvas, "image/jpeg", quality);
      ext = "jpg";
    }
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return { blob, width, height, ext };
  }
  throw new ImageRejected(`${file.name} is still too large after compression.`);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
