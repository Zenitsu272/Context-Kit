import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPdfText(
  blob: Blob,
): Promise<{ text: string; warning?: string }> {
  const loading = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    useWasm: false,
    useSystemFonts: true,
    cMapUrl: chrome.runtime.getURL("pdf-resources/cmaps/"),
    cMapPacked: true,
    standardFontDataUrl: chrome.runtime.getURL("pdf-resources/standard_fonts/"),
  });
  // A password prompt is unavailable in the sidebar; fail quickly and preserve the original.
  let stop: (error: Error) => void = () => undefined;
  const cancelled = new Promise<never>((_, reject) => {
    stop = reject;
  });
  loading.onPassword = () => {
    stop(new Error("Password-protected PDF"));
  };
  const timer = setTimeout(
    () => stop(new Error("PDF extraction timed out")),
    30000,
  );
  try {
    return await Promise.race([
      cancelled,
      (async () => {
        const pdf = await loading.promise;
        const pages: string[] = [];
        let characters = 0;
        let emptyPages = 0;
        let processed = 0;
        for (let number = 1; number <= Math.min(pdf.numPages, 200); number++) {
          const page = await pdf.getPage(number);
          const content = await page.getTextContent();
          let text = "";
          for (const item of content.items) {
            if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
          }
          processed++;
          if (!text.trim()) emptyPages++;
          pages.push(`--- Page ${number} ---\n${text.trim()}`);
          characters += text.length;
          page.cleanup();
          if (characters >= 120000) break;
        }
        const warnings = [];
        if (emptyPages)
          warnings.push(
            `${emptyPages} page(s) had no readable text. Use Gemini for scanned pages or diagrams.`,
          );
        if (processed < pdf.numPages || characters > 120000)
          warnings.push(
            `Extraction limited to ${processed} of ${pdf.numPages} pages and 120,000 characters. Original PDF saved in full.`,
          );
        const joined = pages.join("\n\n");
        if (joined.length > 120000 && characters <= 120000)
          warnings.push(
            "Extracted text shortened to 120,000 characters. The complete original is saved.",
          );
        return {
          text: emptyPages === processed ? "" : joined.slice(0, 120000),
          warning: warnings.join(" ") || undefined,
        };
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    await loading.destroy();
  }
}
