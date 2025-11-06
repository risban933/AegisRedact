import { PDFDocument, rgb } from 'pdf-lib';
import { convertBoxesToPdfLib } from './coordinates';
import type { Box } from './find';

/**
 * PDF metadata for the exported document
 */
export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
}

/**
 * Export canvases as a new PDF with embedded rasterized images
 * This flattens all content - no hidden layers or selectable text
 */
export async function exportPdfFromCanvases(
  canvases: HTMLCanvasElement[],
  meta?: PDFMetadata
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const canvas of canvases) {
    // Convert canvas to PNG blob
    const pngBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png')
    );

    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const pngImage = await pdfDoc.embedPng(pngBytes);

    // Create a page with the same dimensions as the canvas
    const page = pdfDoc.addPage([canvas.width, canvas.height]);

    // Draw the image to fill the entire page
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height
    });
  }

  // Set metadata if provided
  if (meta?.title) pdfDoc.setTitle(meta.title);
  if (meta?.author) pdfDoc.setAuthor(meta.author);
  if (meta?.subject) pdfDoc.setSubject(meta.subject);
  if (meta?.keywords) pdfDoc.setKeywords(meta.keywords);

  // Set creation/modification dates
  const now = new Date();
  pdfDoc.setCreationDate(now);
  pdfDoc.setModificationDate(now);

  return await pdfDoc.save();
}

/**
 * Export PDF with redaction boxes drawn directly on pages (preserves rich text)
 * This maintains the original PDF structure and only adds black rectangles over sensitive areas
 *
 * @param originalPdfBytes - Original PDF file bytes
 * @param pageBoxes - Map of page index to boxes for that page
 * @param scale - Scale factor used during rendering (default: 2)
 * @param meta - Optional PDF metadata
 * @returns Modified PDF with redaction boxes as Uint8Array
 */
export async function exportPdfWithRedactionBoxes(
  originalPdfBytes: ArrayBuffer,
  pageBoxes: Map<number, Box[]>,
  scale: number = 2,
  meta?: PDFMetadata
): Promise<Uint8Array> {
  // Validate inputs
  if (!originalPdfBytes || originalPdfBytes.byteLength === 0) {
    throw new Error('Invalid PDF bytes: empty or null');
  }

  if (scale <= 0) {
    throw new Error(`Invalid scale factor: ${scale}`);
  }

  try {
    // Load the original PDF
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const pages = pdfDoc.getPages();

    console.log(`Exporting PDF with ${pages.length} pages, ${pageBoxes.size} pages have redactions`);

    // Draw redaction boxes on each page
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const boxes = pageBoxes.get(pageIndex);
      if (!boxes || boxes.length === 0) continue;

      const page = pages[pageIndex];
      const { height, width } = page.getSize();

      console.log(`Page ${pageIndex}: size=${width}x${height}, boxes=${boxes.length}`);
      console.log(`Page ${pageIndex}: Original boxes:`, boxes);

      // Convert boxes from canvas coordinates to PDF coordinates
      try {
        const pdfLibBoxes = convertBoxesToPdfLib(boxes, height, scale);
        console.log(`Page ${pageIndex}: Converted boxes:`, pdfLibBoxes);

        // Draw black rectangles over sensitive areas
        for (let i = 0; i < pdfLibBoxes.length; i++) {
          const box = pdfLibBoxes[i];
          console.log(`Drawing box ${i}:`, box);

          // Validate before drawing
          if (isNaN(box.x) || isNaN(box.y) || isNaN(box.width) || isNaN(box.height)) {
            console.error(`Box ${i} has NaN values, skipping:`, box);
            continue;
          }

          page.drawRectangle({
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            color: rgb(0, 0, 0), // Opaque black
            opacity: 1.0,
            borderWidth: 0
          });
        }
      } catch (error) {
        console.error(`Error processing boxes for page ${pageIndex}:`, error);
        throw error;
      }
    }

    // Set metadata if provided
    if (meta?.title) pdfDoc.setTitle(meta.title);
    if (meta?.author) pdfDoc.setAuthor(meta.author);
    if (meta?.subject) pdfDoc.setSubject(meta.subject);
    if (meta?.keywords) pdfDoc.setKeywords(meta.keywords);

    // Update modification date
    pdfDoc.setModificationDate(new Date());

    // Save and return the modified PDF
    return await pdfDoc.save();
  } catch (error) {
    console.error('Error in exportPdfWithRedactionBoxes:', error);
    throw new Error(`Failed to export PDF with redactions: ${error instanceof Error ? error.message : String(error)}`);
  }
}
