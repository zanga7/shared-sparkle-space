/**
 * Client-side image resizer using Canvas API.
 * Converts to JPEG (or PNG for transparent images) and constrains dimensions.
 */

interface ResizeOptions {
  maxWidth: number;
  maxHeight?: number;
  quality?: number; // 0-1, default 0.8
  outputType?: 'image/jpeg' | 'image/webp';
}

/**
 * Loads a File into an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    const url = URL.createObjectURL(file);
    img.src = url;
  });
}

/**
 * Resizes an image file client-side before upload.
 * Returns a new File object with the resized image.
 * If the image is already smaller than maxWidth, it still re-encodes
 * to strip metadata and optimise file size.
 */
export async function resizeImageFile(
  file: File,
  options: ResizeOptions
): Promise<File> {
  const { maxWidth, maxHeight, quality = 0.8, outputType = 'image/jpeg' } = options;

  const img = await loadImage(file);
  const originalUrl = img.src;

  let targetWidth = img.naturalWidth;
  let targetHeight = img.naturalHeight;

  // Scale down if wider than maxWidth
  if (targetWidth > maxWidth) {
    const ratio = maxWidth / targetWidth;
    targetWidth = maxWidth;
    targetHeight = Math.round(targetHeight * ratio);
  }

  // Scale down if taller than maxHeight (if provided)
  if (maxHeight && targetHeight > maxHeight) {
    const ratio = maxHeight / targetHeight;
    targetHeight = maxHeight;
    targetWidth = Math.round(targetWidth * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Use high-quality interpolation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Clean up object URL
  URL.revokeObjectURL(originalUrl);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
      outputType,
      quality
    );
  });

  // Derive new filename with correct extension
  const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newFileName = `${baseName}.${ext}`;

  return new File([blob], newFileName, { type: outputType });
}

/** Preset for celebration & reward images: 400px wide, JPEG 0.8 */
export function resizeForCard(file: File) {
  return resizeImageFile(file, { maxWidth: 400, quality: 0.8 });
}

/** Preset for screensaver images: 2000px wide, JPEG 0.85 */
export function resizeForScreensaver(file: File) {
  return resizeImageFile(file, { maxWidth: 2000, quality: 0.85 });
}
