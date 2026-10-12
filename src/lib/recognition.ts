import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export async function recognizeFile(file: File, progress: (message: string) => void = () => {}) {
  let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | undefined;
  const recognize = async (image: File | HTMLCanvasElement) => {
    if (!worker) {
      progress("Loading Chinese and English text recognition…");
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker(["chi_sim", "eng"], 1, {
        logger: (event) => {
          if (event.status === "recognizing text") progress(`Recognizing text: ${Math.round(event.progress * 100)}%`);
        },
      });
    }
    const { data } = await worker.recognize(image);
    if (data.text.trim() && data.confidence < 60) {
      throw new Error("The image text is too unclear to summarize reliably. Please upload a sharper scan or a PDF with selectable text.");
    }
    return data.text;
  };
  try {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
      GlobalWorkerOptions.workerSrc = pdfWorker;
      const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
      const document = await loadingTask.promise;
      try {
        if (document.numPages > 60) throw new Error("Please split PDFs with more than 60 pages before uploading.");
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          progress(`Reading PDF page ${pageNumber} of ${document.numPages}…`);
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          let text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
          // Sparse text layers can be just a page number over a scanned report.
          if (text.replace(/\s/g, "").length < 40) {
            const original = page.getViewport({ scale: 1 });
            const scale = Math.min(2400 / original.width, Math.sqrt(12_000_000 / (original.width * original.height)));
            const viewport = page.getViewport({ scale });
            const image = window.document.createElement("canvas");
            image.width = Math.ceil(viewport.width);
            image.height = Math.ceil(viewport.height);
            await page.render({ canvas: image, viewport }).promise;
            text = await recognize(image);
            image.width = image.height = 0;
          }
          if (text.trim()) pages.push(`[Page ${pageNumber}]\n${text.trim()}`);
          page.cleanup();
        }
        const text = pages.join("\n\n");
        if (text.length > 100_000) throw new Error("This file contains too much text. Please split it into smaller reports.");
        return text;
      } finally {
        await loadingTask.destroy();
      }
    }
    if (file.type.startsWith("image/")) return (await recognize(file)).trim();
    if (file.type.startsWith("text/")) {
      const text = await file.text();
      if (text.length > 100_000) throw new Error("Please split this text file before uploading.");
      return text;
    }
    throw new Error("Choose a PDF, image, or text file.");
  } finally {
    await worker?.terminate();
  }
}
