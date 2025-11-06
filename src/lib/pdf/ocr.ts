import { createWorker } from 'tesseract.js';

/**
 * Perform OCR on a canvas using Tesseract.js
 * This is an optional fallback for scanned PDFs or images without extractable text
 */
export async function ocrCanvas(
  canvas: HTMLCanvasElement,
  lang: string = 'eng'
): Promise<string> {
  const worker = await createWorker(lang);

  try {
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

/**
 * Check if OCR should be suggested for a page
 * Returns true if the page has very little or no text
 */
export async function shouldSuggestOCR(page: any): Promise<boolean> {
  const textContent = await page.getTextContent();
  const textLength = textContent.items
    .map((item: any) => item.str)
    .join('')
    .trim().length;

  // Suggest OCR if less than 10 characters found
  return textLength < 10;
}
