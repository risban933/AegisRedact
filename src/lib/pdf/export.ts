import { PDFDocument } from 'pdf-lib';

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
