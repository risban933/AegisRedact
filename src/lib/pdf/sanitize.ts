/**
 * PDF Document Sanitization
 *
 * Removes metadata, annotations, form fields, and other potentially sensitive
 * information from PDF documents before export.
 *
 * Privacy features:
 * - Strip PDF metadata (author, creator, title, subject, keywords, etc.)
 * - Remove annotations (comments, highlights, stamps)
 * - Clear form fields and remove form structure
 * - Strip hyperlinks and JavaScript actions
 * - Remove XMP metadata packets
 * - Remove file attachments
 */

import { PDFDocument, PDFDict, PDFName, PDFArray } from 'pdf-lib';

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  /** Remove document information dictionary (author, title, etc.) */
  stripMetadata: boolean;

  /** Remove all annotations (comments, highlights, etc.) */
  removeAnnotations: boolean;

  /** Clear form fields and remove form structure */
  removeFormFields: boolean;

  /** Remove hyperlinks and URI actions */
  stripHyperlinks: boolean;

  /** Remove XMP metadata stream */
  removeXMPMetadata: boolean;

  /** Remove file attachments */
  removeAttachments: boolean;

  /** Remove JavaScript actions */
  removeJavaScript: boolean;

  /** Remove embedded files */
  removeEmbeddedFiles: boolean;
}

/**
 * Default sanitization options (all enabled for maximum privacy)
 */
export const DEFAULT_SANITIZE_OPTIONS: SanitizeOptions = {
  stripMetadata: true,
  removeAnnotations: true,
  removeFormFields: true,
  stripHyperlinks: true,
  removeXMPMetadata: true,
  removeAttachments: true,
  removeJavaScript: true,
  removeEmbeddedFiles: true
};

/**
 * Sanitization result
 */
export interface SanitizationResult {
  /** Whether sanitization was successful */
  success: boolean;

  /** Items that were removed */
  removed: {
    metadata: boolean;
    annotations: number;
    formFields: number;
    hyperlinks: number;
    xmpMetadata: boolean;
    attachments: number;
    javaScript: number;
    embeddedFiles: number;
  };

  /** Any errors encountered */
  errors: string[];

  /** Sanitized PDF bytes */
  pdfBytes?: Uint8Array;
}

/**
 * Sanitize a PDF document
 */
export async function sanitizePDF(
  pdfBytes: Uint8Array,
  options: Partial<SanitizeOptions> = {}
): Promise<SanitizationResult> {
  const opts = { ...DEFAULT_SANITIZE_OPTIONS, ...options };

  const result: SanitizationResult = {
    success: false,
    removed: {
      metadata: false,
      annotations: 0,
      formFields: 0,
      hyperlinks: 0,
      xmpMetadata: false,
      attachments: 0,
      javaScript: 0,
      embeddedFiles: 0
    },
    errors: []
  };

  try {
    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      updateMetadata: false,
      ignoreEncryption: false
    });

    // Strip metadata
    if (opts.stripMetadata) {
      try {
        await stripDocumentMetadata(pdfDoc);
        result.removed.metadata = true;
      } catch (error) {
        result.errors.push(`Metadata stripping failed: ${error}`);
      }
    }

    // Remove XMP metadata
    if (opts.removeXMPMetadata) {
      try {
        const removed = await removeXMPMetadata(pdfDoc);
        result.removed.xmpMetadata = removed;
      } catch (error) {
        result.errors.push(`XMP removal failed: ${error}`);
      }
    }

    // Remove annotations
    if (opts.removeAnnotations) {
      try {
        result.removed.annotations = await removeAnnotations(pdfDoc);
      } catch (error) {
        result.errors.push(`Annotation removal failed: ${error}`);
      }
    }

    // Remove form fields
    if (opts.removeFormFields) {
      try {
        result.removed.formFields = await removeFormFields(pdfDoc);
      } catch (error) {
        result.errors.push(`Form field removal failed: ${error}`);
      }
    }

    // Remove hyperlinks
    if (opts.stripHyperlinks) {
      try {
        result.removed.hyperlinks = await removeHyperlinks(pdfDoc);
      } catch (error) {
        result.errors.push(`Hyperlink removal failed: ${error}`);
      }
    }

    // Remove JavaScript
    if (opts.removeJavaScript) {
      try {
        result.removed.javaScript = await removeJavaScript(pdfDoc);
      } catch (error) {
        result.errors.push(`JavaScript removal failed: ${error}`);
      }
    }

    // Remove attachments
    if (opts.removeAttachments) {
      try {
        result.removed.attachments = await removeAttachments(pdfDoc);
      } catch (error) {
        result.errors.push(`Attachment removal failed: ${error}`);
      }
    }

    // Remove embedded files
    if (opts.removeEmbeddedFiles) {
      try {
        result.removed.embeddedFiles = await removeEmbeddedFiles(pdfDoc);
      } catch (error) {
        result.errors.push(`Embedded file removal failed: ${error}`);
      }
    }

    // Save sanitized PDF
    result.pdfBytes = await pdfDoc.save({
      useObjectStreams: false, // More compatible
      addDefaultPage: false,
      objectsPerTick: 50
    });

    result.success = true;

  } catch (error) {
    result.errors.push(`Sanitization failed: ${error}`);
    result.success = false;
  }

  return result;
}

/**
 * Strip document metadata (Info dictionary)
 */
async function stripDocumentMetadata(pdfDoc: PDFDocument): Promise<void> {
  // Clear standard metadata fields
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('');
  pdfDoc.setCreator('');

  // Remove creation and modification dates
  const context = pdfDoc.context;
  const infoDict = context.lookup(context.trailerInfo.Info);

  if (infoDict && infoDict instanceof PDFDict) {
    // Remove all standard Info entries
    const keysToRemove = [
      'Title', 'Author', 'Subject', 'Keywords',
      'Creator', 'Producer', 'CreationDate', 'ModDate',
      'Trapped', 'GTS_PDFXVersion', 'GTS_PDFXConformance'
    ];

    keysToRemove.forEach(key => {
      infoDict.delete(PDFName.of(key));
    });
  }
}

/**
 * Remove XMP metadata stream
 */
async function removeXMPMetadata(pdfDoc: PDFDocument): Promise<boolean> {
  const catalog = pdfDoc.catalog;

  // Check if XMP metadata exists
  const metadataRef = catalog.get(PDFName.of('Metadata'));

  if (metadataRef) {
    // Remove metadata reference from catalog
    catalog.delete(PDFName.of('Metadata'));
    return true;
  }

  return false;
}

/**
 * Remove all annotations from all pages
 */
async function removeAnnotations(pdfDoc: PDFDocument): Promise<number> {
  let count = 0;

  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const pageDict = page.node;
    const annotsRef = pageDict.get(PDFName.of('Annots'));

    if (annotsRef) {
      // Get annotations array
      const annots = pageDict.context.lookup(annotsRef);

      if (annots && annots instanceof PDFArray) {
        count += annots.size();
      }

      // Remove annotations array from page
      pageDict.delete(PDFName.of('Annots'));
    }
  }

  return count;
}

/**
 * Remove form fields and AcroForm
 */
async function removeFormFields(pdfDoc: PDFDocument): Promise<number> {
  const catalog = pdfDoc.catalog;
  const acroFormRef = catalog.get(PDFName.of('AcroForm'));

  if (!acroFormRef) {
    return 0; // No form fields
  }

  const acroForm = pdfDoc.context.lookup(acroFormRef);
  let fieldCount = 0;

  if (acroForm && acroForm instanceof PDFDict) {
    const fieldsRef = acroForm.get(PDFName.of('Fields'));

    if (fieldsRef) {
      const fields = pdfDoc.context.lookup(fieldsRef);

      if (fields && fields instanceof PDFArray) {
        fieldCount = fields.size();
      }
    }
  }

  // Remove AcroForm from catalog
  catalog.delete(PDFName.of('AcroForm'));

  return fieldCount;
}

/**
 * Remove hyperlinks (Link annotations and URI actions)
 */
async function removeHyperlinks(pdfDoc: PDFDocument): Promise<number> {
  let count = 0;

  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const pageDict = page.node;
    const annotsRef = pageDict.get(PDFName.of('Annots'));

    if (!annotsRef) continue;

    const annots = pageDict.context.lookup(annotsRef);

    if (annots && annots instanceof PDFArray) {
      const newAnnots: any[] = [];

      // Filter out Link annotations
      for (let i = 0; i < annots.size(); i++) {
        const annotRef = annots.get(i);
        const annot = pageDict.context.lookup(annotRef);

        if (annot && annot instanceof PDFDict) {
          const subtype = annot.get(PDFName.of('Subtype'));

          if (subtype && subtype.toString() === '/Link') {
            count++;
            // Don't add to newAnnots (removing it)
          } else {
            newAnnots.push(annotRef);
          }
        }
      }

      // Update annotations array
      if (count > 0) {
        if (newAnnots.length === 0) {
          pageDict.delete(PDFName.of('Annots'));
        } else {
          const newAnnotsArray = pageDict.context.obj(newAnnots);
          pageDict.set(PDFName.of('Annots'), newAnnotsArray);
        }
      }
    }
  }

  return count;
}

/**
 * Remove JavaScript actions
 */
async function removeJavaScript(pdfDoc: PDFDocument): Promise<number> {
  let count = 0;

  const catalog = pdfDoc.catalog;

  // Remove document-level JavaScript
  const namesRef = catalog.get(PDFName.of('Names'));

  if (namesRef) {
    const names = pdfDoc.context.lookup(namesRef);

    if (names && names instanceof PDFDict) {
      const jsRef = names.get(PDFName.of('JavaScript'));

      if (jsRef) {
        names.delete(PDFName.of('JavaScript'));
        count++;
      }
    }
  }

  // Remove OpenAction if it contains JavaScript
  const openActionRef = catalog.get(PDFName.of('OpenAction'));

  if (openActionRef) {
    const openAction = pdfDoc.context.lookup(openActionRef);

    if (openAction && openAction instanceof PDFDict) {
      const actionType = openAction.get(PDFName.of('S'));

      if (actionType && actionType.toString() === '/JavaScript') {
        catalog.delete(PDFName.of('OpenAction'));
        count++;
      }
    }
  }

  // Remove JavaScript from page actions
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const pageDict = page.node;
    const aaRef = pageDict.get(PDFName.of('AA')); // Additional Actions

    if (aaRef) {
      pageDict.delete(PDFName.of('AA'));
      count++;
    }
  }

  return count;
}

/**
 * Remove file attachments
 */
async function removeAttachments(pdfDoc: PDFDocument): Promise<number> {
  let count = 0;

  const catalog = pdfDoc.catalog;
  const namesRef = catalog.get(PDFName.of('Names'));

  if (!namesRef) return 0;

  const names = pdfDoc.context.lookup(namesRef);

  if (names && names instanceof PDFDict) {
    const embeddedFilesRef = names.get(PDFName.of('EmbeddedFiles'));

    if (embeddedFilesRef) {
      const embeddedFiles = pdfDoc.context.lookup(embeddedFilesRef);

      if (embeddedFiles && embeddedFiles instanceof PDFDict) {
        const namesArrayRef = embeddedFiles.get(PDFName.of('Names'));

        if (namesArrayRef) {
          const namesArray = pdfDoc.context.lookup(namesArrayRef);

          if (namesArray && namesArray instanceof PDFArray) {
            // Names array contains [name1, ref1, name2, ref2, ...]
            count = Math.floor(namesArray.size() / 2);
          }
        }
      }

      // Remove EmbeddedFiles from Names
      names.delete(PDFName.of('EmbeddedFiles'));
    }
  }

  return count;
}

/**
 * Remove embedded files from annotations
 */
async function removeEmbeddedFiles(pdfDoc: PDFDocument): Promise<number> {
  let count = 0;

  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const pageDict = page.node;
    const annotsRef = pageDict.get(PDFName.of('Annots'));

    if (!annotsRef) continue;

    const annots = pageDict.context.lookup(annotsRef);

    if (annots && annots instanceof PDFArray) {
      const newAnnots: any[] = [];

      for (let i = 0; i < annots.size(); i++) {
        const annotRef = annots.get(i);
        const annot = pageDict.context.lookup(annotRef);

        if (annot && annot instanceof PDFDict) {
          const subtype = annot.get(PDFName.of('Subtype'));

          // Remove FileAttachment annotations
          if (subtype && subtype.toString() === '/FileAttachment') {
            count++;
            // Don't add to newAnnots
          } else {
            newAnnots.push(annotRef);
          }
        }
      }

      // Update annotations
      if (count > 0) {
        if (newAnnots.length === 0) {
          pageDict.delete(PDFName.of('Annots'));
        } else {
          const newAnnotsArray = pageDict.context.obj(newAnnots);
          pageDict.set(PDFName.of('Annots'), newAnnotsArray);
        }
      }
    }
  }

  return count;
}

/**
 * Get a summary of what can be sanitized from a PDF
 */
export async function analyzePDF(pdfBytes: Uint8Array): Promise<{
  hasMetadata: boolean;
  annotationCount: number;
  formFieldCount: number;
  hyperlinkCount: number;
  hasXMPMetadata: boolean;
  attachmentCount: number;
  javaScriptCount: number;
  embeddedFileCount: number;
}> {
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Check metadata
  const hasMetadata = !!(
    pdfDoc.getTitle() ||
    pdfDoc.getAuthor() ||
    pdfDoc.getSubject() ||
    pdfDoc.getKeywords().length > 0 ||
    pdfDoc.getProducer() ||
    pdfDoc.getCreator()
  );

  // Count annotations
  let annotationCount = 0;
  let hyperlinkCount = 0;
  let embeddedFileCount = 0;

  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const pageDict = page.node;
    const annotsRef = pageDict.get(PDFName.of('Annots'));

    if (annotsRef) {
      const annots = pageDict.context.lookup(annotsRef);

      if (annots && annots instanceof PDFArray) {
        for (let i = 0; i < annots.size(); i++) {
          const annotRef = annots.get(i);
          const annot = pageDict.context.lookup(annotRef);

          if (annot && annot instanceof PDFDict) {
            annotationCount++;

            const subtype = annot.get(PDFName.of('Subtype'));

            if (subtype && subtype.toString() === '/Link') {
              hyperlinkCount++;
            }

            if (subtype && subtype.toString() === '/FileAttachment') {
              embeddedFileCount++;
            }
          }
        }
      }
    }
  }

  // Check XMP metadata
  const catalog = pdfDoc.catalog;
  const hasXMPMetadata = !!catalog.get(PDFName.of('Metadata'));

  // Count form fields
  let formFieldCount = 0;
  const acroFormRef = catalog.get(PDFName.of('AcroForm'));

  if (acroFormRef) {
    const acroForm = pdfDoc.context.lookup(acroFormRef);

    if (acroForm && acroForm instanceof PDFDict) {
      const fieldsRef = acroForm.get(PDFName.of('Fields'));

      if (fieldsRef) {
        const fields = pdfDoc.context.lookup(fieldsRef);

        if (fields && fields instanceof PDFArray) {
          formFieldCount = fields.size();
        }
      }
    }
  }

  // Count JavaScript
  let javaScriptCount = 0;
  const namesRef = catalog.get(PDFName.of('Names'));

  if (namesRef) {
    const names = pdfDoc.context.lookup(namesRef);

    if (names && names instanceof PDFDict) {
      if (names.get(PDFName.of('JavaScript'))) {
        javaScriptCount++;
      }
    }
  }

  // Count attachments
  let attachmentCount = 0;

  if (namesRef) {
    const names = pdfDoc.context.lookup(namesRef);

    if (names && names instanceof PDFDict) {
      const embeddedFilesRef = names.get(PDFName.of('EmbeddedFiles'));

      if (embeddedFilesRef) {
        const embeddedFiles = pdfDoc.context.lookup(embeddedFilesRef);

        if (embeddedFiles && embeddedFiles instanceof PDFDict) {
          const namesArrayRef = embeddedFiles.get(PDFName.of('Names'));

          if (namesArrayRef) {
            const namesArray = pdfDoc.context.lookup(namesArrayRef);

            if (namesArray && namesArray instanceof PDFArray) {
              attachmentCount = Math.floor(namesArray.size() / 2);
            }
          }
        }
      }
    }
  }

  return {
    hasMetadata,
    annotationCount,
    formFieldCount,
    hyperlinkCount,
    hasXMPMetadata,
    attachmentCount,
    javaScriptCount,
    embeddedFileCount
  };
}
