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

  console.log('findTextBoxes: Processing', textContent.items.length, 'text items');

  for (const item of textContent.items as any[]) {
    const str = (item.str ?? '').trim();
    if (!str) continue;

    const matches = predicate(str);
    if (!matches) continue;

    console.log('findTextBoxes: Match found for:', str);

    // transform: [a, b, c, d, e, f] (PDF coordinate system, origin bottom-left)
    const transform = item.transform as number[];
    console.log('findTextBoxes: transform:', transform, 'item.width:', item.width);

    if (!transform || transform.length !== 6) {
      console.error('findTextBoxes: Invalid transform matrix', transform);
      continue;
    }

    const [a, b, c, d, e, f] = transform;

    // Approximate font height from transform matrix
    const fontHeight = Math.hypot(b, d);
    console.log('findTextBoxes: fontHeight:', fontHeight);

    // Convert PDF coordinates to viewport/canvas coordinates
    // NOTE: convertToViewportPoint returns an ARRAY [x, y], not an object {x, y}!
    const viewportPoint = viewport.convertToViewportPoint(e, f);
    console.log('findTextBoxes: viewportPoint:', viewportPoint, 'viewport.scale:', viewport.scale);

    // Destructure as array
    const [x, y] = viewportPoint;

    // Convert baseline y to top-left y by subtracting height
    const height = fontHeight * viewport.scale;
    const width = (item.width ?? 0) * viewport.scale;

    console.log('findTextBoxes: Calculated - x:', x, 'y:', y, 'width:', width, 'height:', height);

    // Validate calculated values
    if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
      console.error('findTextBoxes: NaN detected in box calculation!', {
        x, y, width, height,
        item_width: item.width,
        fontHeight,
        viewport_scale: viewport.scale,
        transform
      });
      continue; // Skip this box
    }

    const box = {
      x,
      y: y - height,
      w: width,
      h: height,
      text: str
    };

    console.log('findTextBoxes: Created box:', box);
    boxes.push(box);
  }

  console.log('findTextBoxes: Returning', boxes.length, 'boxes');
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
