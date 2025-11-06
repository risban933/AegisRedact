/**
 * Text extraction and bounding box detection for PDFs
 */

export type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
};

/**
 * Find text boxes on a PDF page that match a predicate
 * Converts PDF coordinates to canvas coordinates using the viewport
 */
export async function findTextBoxes(
  page: any,
  viewport: any,
  predicate: (s: string) => boolean
): Promise<Box[]> {
  const textContent = await page.getTextContent();
  const boxes: Box[] = [];

  for (const item of textContent.items as any[]) {
    const str = (item.str ?? '').trim();
    if (!str) continue;
    if (!predicate(str)) continue;

    // transform: [a, b, c, d, e, f] (PDF coordinate system, origin bottom-left)
    const [a, b, c, d, e, f] = item.transform as number[];

    // Approximate font height from transform matrix
    const fontHeight = Math.hypot(b, d);

    // Convert PDF coordinates to viewport/canvas coordinates
    const { x, y } = viewport.convertToViewportPoint(e, f);

    // Convert baseline y to top-left y by subtracting height
    const height = fontHeight * viewport.scale;
    const width = (item.width ?? 0) * viewport.scale;

    boxes.push({
      x,
      y: y - height,
      w: width,
      h: height,
      text: str
    });
  }

  return boxes;
}

/**
 * Extract all text from a PDF page
 */
export async function extractPageText(page: any): Promise<string> {
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item: any) => item.str)
    .join(' ');
}

/**
 * Find boxes for specific text matches in a page
 */
export async function findMatchingBoxes(
  page: any,
  viewport: any,
  searchTerms: string[]
): Promise<Box[]> {
  const termSet = new Set(searchTerms);
  return findTextBoxes(page, viewport, (text) => termSet.has(text));
}
