import type { DetectionResult } from '../detect/merger';
import type { OCRWord } from '../images/ocr';
import type { Box } from '../pdf/find';

/**
 * Character position mapping for an OCR word
 */
interface WordPosition {
  word: OCRWord;
  startChar: number;
  endChar: number;
}

/**
 * Build a character position map from OCR words
 * This allows us to map character offsets in the full text back to word bounding boxes
 */
function buildCharacterMap(words: OCRWord[], fullText: string): WordPosition[] {
  const positions: WordPosition[] = [];
  let currentPos = 0;

  // Reconstruct the text to match OCR output (words separated by spaces)
  for (const word of words) {
    const wordText = word.text;

    // Find this word in the full text starting from currentPos
    const wordIndex = fullText.indexOf(wordText, currentPos);

    if (wordIndex >= 0) {
      positions.push({
        word,
        startChar: wordIndex,
        endChar: wordIndex + wordText.length,
      });
      currentPos = wordIndex + wordText.length;
    }
  }

  return positions;
}

/**
 * Find the character position of a detected term in the full text
 * Uses case-insensitive matching and handles multiple occurrences
 */
function findTermPositions(
  term: string,
  fullText: string
): Array<{ start: number; end: number }> {
  const positions: Array<{ start: number; end: number }> = [];
  const normalizedText = fullText.toLowerCase();
  const normalizedTerm = term.toLowerCase();

  let startIndex = 0;
  while (true) {
    const index = normalizedText.indexOf(normalizedTerm, startIndex);
    if (index === -1) break;

    positions.push({
      start: index,
      end: index + term.length,
    });

    startIndex = index + 1; // Find next occurrence
  }

  return positions;
}

/**
 * Find OCR words that overlap with a character range
 */
function findOverlappingWords(
  charStart: number,
  charEnd: number,
  wordPositions: WordPosition[]
): OCRWord[] {
  const overlapping: OCRWord[] = [];

  for (const wordPos of wordPositions) {
    // Check if word overlaps with the character range
    if (
      wordPos.endChar > charStart &&
      wordPos.startChar < charEnd
    ) {
      overlapping.push(wordPos.word);
    }
  }

  return overlapping;
}

/**
 * Combine multiple word bounding boxes into a single box
 * Returns the union of all boxes (smallest box that contains all words)
 */
function combineBoxes(words: OCRWord[]): { x: number; y: number; w: number; h: number } | null {
  if (words.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const word of words) {
    const { x, y, width, height } = word.bbox;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

/**
 * Map PII detection results to bounding boxes using OCR word positions
 * This is used for images and scanned PDFs where PDF.js text coordinates aren't available
 *
 * @param detections - Array of detected PII items
 * @param ocrWords - OCR words with bounding boxes
 * @param fullText - The complete OCR text
 * @param pageIndex - Page number (for multi-page documents)
 * @param scaleFactor - Optional scaling factor to apply to coordinates (default: 1.0)
 * @returns Array of bounding boxes for redaction
 */
export function mapPIIToOCRBoxes(
  detections: DetectionResult[],
  ocrWords: OCRWord[],
  fullText: string,
  pageIndex: number = 0,
  scaleFactor: number = 1.0
): Box[] {
  const boxes: Box[] = [];
  const wordPositions = buildCharacterMap(ocrWords, fullText);

  console.log('mapPIIToOCRBoxes: Processing', detections.length, 'detections');
  console.log('mapPIIToOCRBoxes: OCR words:', ocrWords.length);
  console.log('mapPIIToOCRBoxes: Word positions:', wordPositions.length);

  for (const detection of detections) {
    // If detection has explicit positions, use those
    if (detection.positions) {
      const words = findOverlappingWords(
        detection.positions.start,
        detection.positions.end,
        wordPositions
      );

      const combined = combineBoxes(words);
      if (combined) {
        boxes.push({
          x: combined.x * scaleFactor,
          y: combined.y * scaleFactor,
          w: combined.w * scaleFactor,
          h: combined.h * scaleFactor,
          text: detection.text,
          type: detection.type,
          source: detection.source,
          confidence: detection.confidence,
          page: pageIndex,
        });
      }
    } else {
      // No explicit positions - search for the term in the text
      const termPositions = findTermPositions(detection.text, fullText);

      console.log(`mapPIIToOCRBoxes: Found ${termPositions.length} occurrences of "${detection.text}"`);

      for (const pos of termPositions) {
        const words = findOverlappingWords(pos.start, pos.end, wordPositions);

        const combined = combineBoxes(words);
        if (combined) {
          boxes.push({
            x: combined.x * scaleFactor,
            y: combined.y * scaleFactor,
            w: combined.w * scaleFactor,
            h: combined.h * scaleFactor,
            text: detection.text,
            type: detection.type,
            source: detection.source,
            confidence: detection.confidence,
            page: pageIndex,
          });
        }
      }
    }
  }

  console.log('mapPIIToOCRBoxes: Created', boxes.length, 'boxes');
  return boxes;
}

/**
 * Expand boxes by a padding amount (in pixels)
 * This ensures we don't leave any visible pixels around detected text
 */
export function expandBoxes(boxes: Box[], padding: number = 4): Box[] {
  return boxes.map(box => ({
    ...box,
    x: box.x - padding,
    y: box.y - padding,
    w: box.w + padding * 2,
    h: box.h + padding * 2,
  }));
}
