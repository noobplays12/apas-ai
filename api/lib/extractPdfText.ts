import { createRequire } from 'module';
import { fileURLToPath } from 'url';

/**
 * Text extraction using pdfjs-dist (bundles predictably on Vercel).
 * pdf-parse uses dynamic requires into nested pdf.js folders that the serverless bundle often omits → FUNCTION_INVOCATION_FAILED.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const require = createRequire(fileURLToPath(import.meta.url));
  // Use legacy build; it tends to bundle more predictably in serverless environments.
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js') as any;
  pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

  try {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
      stopAtErrors: true,
    });

    const pdf = await loadingTask.promise as PdfDoc;

    let full = '';
    const n = pdf.numPages;
    for (let p = 1; p <= n; p++) {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      for (const item of textContent.items) {
        const it = item as { str?: string };
        if (typeof it.str === 'string') full += it.str;
      }
      full += '\n';
    }

    await pdf.destroy();
    return full;
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : String(e);
    throw new Error(`PDF text extraction failed: ${msg}`);
  }
}

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>;
  }>;
  destroy: () => Promise<void>;
};
