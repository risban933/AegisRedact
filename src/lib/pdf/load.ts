import { pdfjsLib } from './worker';

/**
 * Load a PDF document from various sources
 */
export async function loadPdf(data: ArrayBuffer | Uint8Array) {
  const doc = await (pdfjsLib as any).getDocument({ data }).promise;
  return doc;
}

/**
 * Render a PDF page to a canvas at the specified scale
 * Returns the page, canvas, and viewport for further processing
 */
export async function renderPageToCanvas(
  doc: any,
  pageIndex: number,
  scale = 2
): Promise<{ page: any; canvas: HTMLCanvasElement; viewport: any }> {
  const page = await doc.getPage(pageIndex + 1); // PDF pages are 1-indexed
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({
    canvasContext: ctx,
    viewport
  }).promise;

  return { page, canvas, viewport };
}

/**
 * Get the number of pages in a PDF document
 */
export function getPageCount(doc: any): number {
  return doc.numPages;
}
