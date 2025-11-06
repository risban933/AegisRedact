import { fileOpen, fileSave } from 'browser-fs-access';

/**
 * Cross-platform file I/O using browser-fs-access
 * Uses File System Access API where available, with download/upload fallback
 */

/**
 * Open files with native picker (or fallback)
 */
export async function pickFiles(
  accept: Record<string, string[]>,
  multiple: boolean = true
): Promise<File[]> {
  const mimeTypes = Object.keys(accept);
  const extensions = Object.values(accept).flat();

  const files = await fileOpen({
    mimeTypes,
    extensions,
    multiple
  });

  return Array.isArray(files) ? files : [files];
}

/**
 * Save a blob with suggested filename
 */
export async function saveBlob(
  blob: Blob,
  suggestedName: string
): Promise<void> {
  await fileSave(blob, {
    fileName: suggestedName,
    extensions: [`.${suggestedName.split('.').pop()}`]
  });
}

/**
 * Accept types for different file formats
 */
export const ACCEPT_IMAGES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};

export const ACCEPT_PDF = {
  'application/pdf': ['.pdf']
};

export const ACCEPT_ALL = {
  ...ACCEPT_IMAGES,
  ...ACCEPT_PDF
};
