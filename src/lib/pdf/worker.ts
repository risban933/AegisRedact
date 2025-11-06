/**
 * Configure PDF.js worker for Vite builds
 */
import * as pdfjsLib from 'pdfjs-dist';

// Point to the worker file copied by vite-plugin-static-copy
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.min.mjs';

export { pdfjsLib };
