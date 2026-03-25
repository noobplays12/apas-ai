import { createRequire } from 'module';
import { fileURLToPath } from 'url';

/**
 * Text extraction using pdfjs-dist (bundles predictably on Vercel).
 * pdf-parse uses dynamic requires into nested pdf.js folders that the serverless bundle often omits → FUNCTION_INVOCATION_FAILED.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const require = createRequire(fileURLToPath(import.meta.url));
  const pdfjsLib = require('pdfjs-dist/build/pdf.js') as {
    getDocument: (opts: Record<string, unknown>) => { promise: Promise<PdfDoc> };
    GlobalWorkerOptions: { workerSrc: string };
  };

  pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.js');

  const data = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
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
}

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>;
  }>;
  destroy: () => Promise<void>;
};
