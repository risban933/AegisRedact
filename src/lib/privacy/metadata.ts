/**
 * Metadata Extractor
 *
 * Extracts metadata from PDFs and images for privacy analysis.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentMetadata } from './types';

/**
 * Extract metadata from PDF document
 */
export async function extractPDFMetadata(
  pdfDoc: PDFDocumentProxy,
  fileName: string,
  fileSize: number
): Promise<DocumentMetadata> {
  const metadata = await pdfDoc.getMetadata();
  const info = metadata.info;

  const result: DocumentMetadata = {
    fileName,
    fileType: 'application/pdf',
    fileSize
  };

  // Extract standard PDF metadata fields
  if (info.Title) result.title = String(info.Title);
  if (info.Author) result.author = String(info.Author);
  if (info.Subject) result.subject = String(info.Subject);
  if (info.Creator) result.creator = String(info.Creator);
  if (info.Producer) result.producer = String(info.Producer);

  // Parse dates if present
  if (info.CreationDate) {
    result.creationDate = parsePDFDate(String(info.CreationDate));
  }
  if (info.ModDate) {
    result.modificationDate = parsePDFDate(String(info.ModDate));
  }

  return result;
}

/**
 * Extract EXIF metadata from image
 */
export async function extractImageMetadata(
  imageFile: File
): Promise<DocumentMetadata> {
  const metadata: DocumentMetadata = {
    fileName: imageFile.name,
    fileType: imageFile.type,
    fileSize: imageFile.size
  };

  // Try to extract EXIF data
  try {
    const exif = await extractEXIFData(imageFile);
    if (exif && Object.keys(exif).length > 0) {
      metadata.exif = exif;
    }
  } catch (error) {
    console.warn('[extractImageMetadata] Failed to extract EXIF:', error);
  }

  return metadata;
}

/**
 * Extract EXIF data from image file
 */
async function extractEXIFData(file: File): Promise<any> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (!arrayBuffer) {
        resolve({});
        return;
      }

      try {
        const exif = parseEXIF(new Uint8Array(arrayBuffer));
        resolve(exif);
      } catch (error) {
        console.warn('[extractEXIFData] EXIF parse error:', error);
        resolve({});
      }
    };

    reader.onerror = () => {
      resolve({});
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse EXIF data from image buffer
 * Simplified EXIF parser - supports common fields
 */
function parseEXIF(buffer: Uint8Array): any {
  const exif: any = {};

  // Check for JPEG SOI marker (0xFFD8)
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return exif; // Not a JPEG
  }

  // Find APP1 marker (0xFFE1) containing EXIF data
  let offset = 2;
  while (offset < buffer.length - 1) {
    if (buffer[offset] === 0xFF && buffer[offset + 1] === 0xE1) {
      // Found APP1 marker
      const segmentLength = (buffer[offset + 2] << 8) | buffer[offset + 3];
      const segmentData = buffer.slice(offset + 4, offset + 4 + segmentLength - 2);

      // Check for "Exif\0\0" header
      if (
        segmentData[0] === 0x45 && // 'E'
        segmentData[1] === 0x78 && // 'x'
        segmentData[2] === 0x69 && // 'i'
        segmentData[3] === 0x66 && // 'f'
        segmentData[4] === 0x00 &&
        segmentData[5] === 0x00
      ) {
        // Parse EXIF tags (simplified - only common tags)
        const tiffHeader = segmentData.slice(6);
        parseEXIFTags(tiffHeader, exif);
      }

      break;
    }

    offset++;
  }

  return exif;
}

/**
 * Parse EXIF tags from TIFF header
 * Simplified parser for common tags
 */
function parseEXIFTags(tiffData: Uint8Array, exif: any): void {
  // Check byte order (II = little-endian, MM = big-endian)
  const littleEndian = tiffData[0] === 0x49 && tiffData[1] === 0x49;

  // For simplicity, we'll just extract common string fields using regex patterns
  // Full EXIF parsing would require handling TIFF structure properly

  const dataStr = String.fromCharCode.apply(null, Array.from(tiffData.slice(0, 1000)));

  // Look for common EXIF strings
  const makeMatch = dataStr.match(/Canon|Nikon|Sony|Apple|Samsung|Fujifilm|Olympus|Panasonic|Leica/);
  if (makeMatch) exif.make = makeMatch[0];

  const softwareMatch = dataStr.match(/Photoshop|Lightroom|GIMP|Paint\.NET|Affinity/);
  if (softwareMatch) exif.software = softwareMatch[0];

  // GPS data detection (presence of GPS tags)
  if (dataStr.includes('GPS')) {
    // Simplified: we can't easily extract exact coordinates without full TIFF parsing
    // But we can flag that GPS data exists
    exif.gps = {
      latitude: 0, // Placeholder - full parsing would extract actual values
      longitude: 0
    };
  }

  // Note: A production implementation would use a proper EXIF library
  // For this demo, we're using a simplified parser
}

/**
 * Parse PDF date string to JavaScript Date
 * PDF date format: D:YYYYMMDDHHmmSSOHH'mm
 */
function parsePDFDate(dateStr: string): Date {
  // Remove "D:" prefix if present
  if (dateStr.startsWith('D:')) {
    dateStr = dateStr.substring(2);
  }

  // Extract components
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
  const day = parseInt(dateStr.substring(6, 8));
  const hour = parseInt(dateStr.substring(8, 10) || '0');
  const minute = parseInt(dateStr.substring(10, 12) || '0');
  const second = parseInt(dateStr.substring(12, 14) || '0');

  return new Date(year, month, day, hour, minute, second);
}

/**
 * Create empty metadata for text documents
 */
export function createTextDocumentMetadata(
  fileName: string,
  fileType: string,
  fileSize: number
): DocumentMetadata {
  return {
    fileName,
    fileType,
    fileSize
  };
}
