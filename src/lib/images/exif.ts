/**
 * EXIF/GPS removal utilities
 * Canvas re-encode strips all metadata, which is exactly what we want for privacy
 */

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Strip EXIF data by re-encoding through canvas
 * This removes GPS, camera info, orientation, and all other metadata
 */
export async function stripExif(
  img: HTMLImageElement,
  type: ImageFormat = 'image/jpeg',
  quality: number = 0.92
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), type, quality);
  });
}

/**
 * Load an image file into an HTMLImageElement
 */
export async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get image dimensions without loading the full image
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  const img = await loadImage(file);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight
  };
}
