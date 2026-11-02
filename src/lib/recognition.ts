import { inspectReportImage, VisionServiceUnavailable } from "./vision-recognition";
import { assessRecognizedPage, joinRecognizedPages, type RecognitionResult } from "./recognition-review";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const MAX_PIXELS = 12_000_000;

async function imageToCanvas(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot read images.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

export async function recognizeFileDetailed(file: File, progress: (message: string) => void = () => {}) {
  let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | undefined;
  const recognize = async (canvas: HTMLCanvasElement, pageNumber = 1): Promise<RecognitionResult> => {
    if (!worker) {
      progress("Loading Chinese and English text recognition…");
      const { createWorker, PSM } = await import("tesseract.js");
      worker = await createWorker(["chi_sim", "eng"], 1, {
        logger: (event) => {
          if (event.status === "recognizing text") progress(`Recognizing text: ${Math.round(event.progress * 100)}%`);
        },
      });
      // The default single-block mode turns bordered result tables into garbage
      // ("Rr EE", "sens | as | won"); automatic layout keeps each table row intact.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    }
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    progress("AI is checking the original image for blurred or missing characters…");
    try {
      return await inspectReportImage(canvas.toDataURL("image/jpeg", 0.95), data.text, pageNumber);
    } catch (error) {
      if (!(error instanceof VisionServiceUnavailable)) throw error;
      progress("Checking unclear values against the original…");
      const lines = (data.blocks || []).flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines.map(line => ({
        text: line.text, confidence: line.confidence,
        words: line.words.map(word => ({ text: word.text, confidence: word.confidence, bbox: word.bbox })),
      }))));
      const rgba = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      const gray = new Uint8Array(canvas.width * canvas.height);
      for (let i = 0; i < gray.length; i++) gray[i] = Math.round(rgba[i * 4] * .299 + rgba[i * 4 + 1] * .587 + rgba[i * 4 + 2] * .114);
      const checked = assessRecognizedPage(data.text, pageNumber, data.confidence, lines, { width: canvas.width, height: canvas.height, data: gray });
      return { ...checked, issues: checked.issues.map(issue => ({ ...issue, frame: { width: canvas.width, height: canvas.height } })) };
    }
  };
  try {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
      GlobalWorkerOptions.workerSrc = pdfWorker;
      const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
      const document = await loadingTask.promise;
      try {
        if (document.numPages > 60) throw new Error("Please split PDFs with more than 60 pages before uploading.");
        const pages: RecognitionResult[] = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          progress(`Reading PDF page ${pageNumber} of ${document.numPages}…`);
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
          let recognized: RecognitionResult = { text, needsReview: false, issues: [], scannedPages: [] };
          // Sparse text layers can be just a page number over a scanned report.
          if (text.replace(/\s/g, "").length < 40) {
            const original = page.getViewport({ scale: 1 });
            const scale = Math.min(2400 / original.width, Math.sqrt(MAX_PIXELS / (original.width * original.height)));
            const viewport = page.getViewport({ scale });
            const image = window.document.createElement("canvas");
            image.width = Math.ceil(viewport.width);
            image.height = Math.ceil(viewport.height);
            await page.render({ canvas: image, viewport }).promise;
            try { recognized = await recognize(image, pageNumber); }
            finally { image.width = image.height = 0; }
          }
          // Preserve blank OCR pages too: the user can transcribe a fully unreadable scan.
          pages.push({ ...recognized, text: `[Page ${pageNumber}]\n${recognized.text}`, issues: recognized.issues.map((issue) => ({ ...issue, line: issue.line + 1 })) });
          page.cleanup();
        }
        const result = joinRecognizedPages(pages);
        if (result.text.length > 100_000) throw new Error("This file contains too much text. Please split it into smaller reports.");
        return result;
      } finally {
        await loadingTask.destroy();
      }
    }
    if (file.type.startsWith("image/")) {
      progress("Preparing the image…");
      const canvas = await imageToCanvas(file);
      try { return await recognize(canvas); }
      finally { canvas.width = canvas.height = 0; }
    }
    if (file.type.startsWith("text/")) {
      const text = await file.text();
      if (text.length > 100_000) throw new Error("Please split this text file before uploading.");
      return { text, needsReview: false, issues: [], scannedPages: [] } satisfies RecognitionResult;
    }
    throw new Error("Choose a PDF, image, or text file.");
  } finally {
    await worker?.terminate();
  }
}

// Callers without a review UI must never silently accept text with flagged values.
export async function recognizeFile(file: File, progress: (message: string) => void = () => {}) {
  const result = await recognizeFileDetailed(file, progress);
  if (result.needsReview) throw new Error("Some values in this scanned report need checking against the original before saving.");
  return result.text;
}
