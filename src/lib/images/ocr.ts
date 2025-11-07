import { createWorker } from 'tesseract.js';

/**
 * OCR result with word-level bounding boxes
 */
export interface OCRWord {
  text: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface OCRResult {
  text: string;
  words: OCRWord[];
}

/**
 * Perform OCR on an image canvas and return text with word-level bounding boxes
 * This is used for images and scanned PDFs where PDF.js text coordinates aren't available
 */
export async function ocrImageCanvas(
  canvas: HTMLCanvasElement,
  lang: string = 'eng'
): Promise<OCRResult> {
  const worker = await createWorker(lang);

  try {
    const { data } = await worker.recognize(canvas);

    // Extract word-level bounding boxes
    const words: OCRWord[] = (data.words || []).map((word: any) => ({
      text: word.text,
      bbox: {
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
      },
      confidence: word.confidence / 100, // Tesseract returns 0-100, normalize to 0-1
    }));

    return {
      text: data.text || '',
      words,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Simple OCR that only returns text (for backward compatibility)
 */
export async function ocrCanvas(
  canvas: HTMLCanvasElement,
  lang: string = 'eng'
): Promise<string> {
  const result = await ocrImageCanvas(canvas, lang);
  return result.text;
}
