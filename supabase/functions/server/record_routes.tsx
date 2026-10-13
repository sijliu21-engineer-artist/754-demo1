import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import type { Hono } from "npm:hono";
import { resolveSession } from "./auth_routes.tsx";
import * as kv from "./kv_store.tsx";

const bucket = "casemate-records";
const maxFileBytes = 8 * 1024 * 1024;
const maxExtractedCharacters = 100_000;

export type MedicalRecord = {
  id: string;
  username: string;
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  extractedText: string;
  extractionStatus: "ready" | "needs_ocr" | "no_text";
  createdAt: string;
  files?: Array<{ fileName: string; mimeType: string; size: number; storagePath: string }>;
};

const storageClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const safeFileName = (value: string) =>
  value.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120) ||
  "medical-record";

export const storageFileName = (displayName: string) => {
  const extension = displayName.match(/\.[a-z0-9]{1,10}$/i)?.[0].toLowerCase() || ".bin";
  return `original${extension}`;
};

const redactMedicalText = (value: string) =>
  value
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[EMAIL REDACTED]",
    )
    .replace(/\b1[3-9]\d{9}\b/g, "[PHONE REDACTED]")
    .replace(/\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/g, "[PHONE REDACTED]")
    .replace(/\b\d{17}[\dXx]\b/g, "[ID REDACTED]")
    .replace(
      /((?:姓名|患者|Name|Patient)\s*[:：]\s*)[^\s,，;；]{1,40}/gi,
      "$1[NAME REDACTED]",
    );

const sessionFor = async (c: {
  req: { header: (name: string) => string | undefined };
}) => resolveSession(c.req.header("X-CaseMate-Session"));

export const recordsForUser = async (username: string) => {
  const candidates = (await kv.getByPrefix(`records:${username}:`)) as MedicalRecord[];
  // SQL LIKE treats underscores in account names as wildcards.
  // Always verify ownership after the prefix lookup.
  return candidates.filter((record) => record.username === username);
};

const tokens = (value: string) =>
  Array.from(
    new Set(
      value
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}][\p{L}\p{N}._/-]*/gu) ?? [],
    ),
  ).filter((token) => token.length > 1);

export const retrieveRecordContext = async (
  username: string,
  question: string,
) => {
  const records = await recordsForUser(username);
  const queryTokens = tokens(question);
  const chunks = records.flatMap((record) => {
    const text = record.extractedText.trim();
    if (!text) return [];
    const pieces: Array<{ record: MedicalRecord; text: string; score: number }> =
      [];
    for (let offset = 0; offset < text.length; offset += 2400) {
      const chunk = text.slice(offset, offset + 2800);
      const haystack = chunk.toLocaleLowerCase();
      const score = queryTokens.reduce(
        (total, token) => total + (haystack.includes(token) ? 1 : 0),
        0,
      );
      pieces.push({ record, text: chunk, score });
    }
    return pieces;
  });
  chunks.sort(
    (left, right) =>
      right.score - left.score ||
      right.record.createdAt.localeCompare(left.record.createdAt),
  );
  const selected = chunks.slice(0, 5);
  if (!selected.length) {
    return "No machine-readable text is available in this user's uploaded records.";
  }
  return selected
    .map(
      ({ record, text }) =>
        `SOURCE: ${record.fileName} (uploaded ${record.createdAt})\n${text}`,
    )
    .join("\n\n---\n\n")
    .slice(0, 14_000);
};

export const registerRecordRoutes = (app: Hono) => {
  app.post("/make-server-ba71e98d/records/:id/recognition-url", async (c) => {
    const session = await sessionFor(c);
    if (!session) return c.json({ error: "Please log in again." }, 401);
    try {
      const record = await kv.get(`records:${session.username}:${c.req.param("id")}`) as MedicalRecord | undefined;
      if (!record || record.username !== session.username) return c.json({ error: "Record not found." }, 404);
      const originals = record.files || [record];
      const files = await Promise.all(originals.map(async (file) => {
        const { data, error } = await storageClient().storage.from(bucket).createSignedUrl(file.storagePath, 120);
        if (error) throw error;
        return { url: data.signedUrl, fileName: file.fileName, mimeType: file.mimeType };
      }));
      return c.json({ ...files[0], files });
    } catch {
      return c.json({ error: "Unable to open the original file." }, 500);
    }
  });

  app.put("/make-server-ba71e98d/records/:id/text", async (c) => {
    const session = await sessionFor(c);
    if (!session) return c.json({ error: "Please log in again." }, 401);
    try {
      const key = `records:${session.username}:${c.req.param("id")}`;
      const record = await kv.get(key) as MedicalRecord | undefined;
      if (!record || record.username !== session.username) return c.json({ error: "Record not found." }, 404);
      const payload = await c.req.json();
      if (typeof payload.extractedText !== "string" || !payload.extractedText.trim() || payload.extractedText.length > maxExtractedCharacters) {
        return c.json({ error: "No readable text was recognized, or the text is too long." }, 400);
      }
      const extractedText = redactMedicalText(payload.extractedText).replace(/\0/g, "").trim();
      await kv.set(key, { ...record, extractedText, extractionStatus: "ready" });
      return c.json({ status: "ready" });
    } catch {
      return c.json({ error: "Unable to save recognized text." }, 500);
    }
  });

  app.get("/make-server-ba71e98d/records", async (c) => {
    const session = await sessionFor(c);
    if (!session) return c.json({ error: "Please log in again." }, 401);
    try {
      const records = await recordsForUser(session.username);
      return c.json({
        user: { username: session.username, displayName: session.displayName },
        records: records
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(({ extractedText: _text, storagePath: _path, files, ...record }) => ({ ...record, files: files?.map(({ storagePath: _p, ...file }) => file) })),
      });
    } catch (error) {
      console.error("Record listing failed", error);
      return c.json({ error: "Unable to load uploaded records." }, 500);
    }
  });

  app.post("/make-server-ba71e98d/records", async (c) => {
    const session = await sessionFor(c);
    if (!session) return c.json({ error: "Please log in again." }, 401);

    let payload: {
      fileName?: string;
      mimeType?: string;
      size?: number;
      base64?: string;
      extractedText?: string;
      files?: Array<{ fileName: string; mimeType: string; size: number; base64: string; extractedText: string }>;
    };
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "Invalid upload request." }, 400);
    }
    if (payload.files) {
      if (!Array.isArray(payload.files) || !payload.files.length || payload.files.length > 10) return c.json({ error: "Select between 1 and 10 files." }, 400);
      const prepared = [];
      try {
        for (const file of payload.files) {
          if (typeof file.base64 !== "string" || typeof file.fileName !== "string" || typeof file.mimeType !== "string" || typeof file.extractedText !== "string") throw new Error("Invalid file data.");
          if (!file.mimeType.startsWith("image/") && file.mimeType !== "application/pdf") throw new Error("Only images and PDFs are supported.");
          if (!file.extractedText.trim()) throw new Error(`No readable text in ${file.fileName}. Recognize every file before uploading this batch.`);
          if (!file.size || file.size > maxFileBytes) throw new Error("Each file must be no larger than 8 MB.");
          const bytes = decodeBase64(file.base64);
          if (bytes.length !== file.size) throw new Error("An uploaded file is incomplete.");
          prepared.push({ ...file, fileName: safeFileName(file.fileName), bytes });
        }
        if (prepared.reduce((n, f) => n + f.size, 0) > 24 * 1024 * 1024) throw new Error("Select files totaling no more than 24 MB.");
        if (prepared.reduce((n, f) => n + f.extractedText.length + f.fileName.length + 30, 0) > maxExtractedCharacters) throw new Error("The combined recognized text is too long. Split this upload.");
      } catch (error) { return c.json({ error: error instanceof Error ? error.message : "Invalid files." }, 400); }
      const id = crypto.randomUUID();
      const supabase = storageClient();
      const savedPaths: string[] = [];
      try {
        const { error: bucketError } = await supabase.storage.createBucket(bucket, { public: false, fileSizeLimit: maxFileBytes });
        if (bucketError && !/already exists/i.test(bucketError.message)) throw bucketError;
        const files = [];
        for (const [index, file] of prepared.entries()) {
          const storagePath = `${session.username}/${id}/${index}/${storageFileName(file.fileName)}`;
          const { error } = await supabase.storage.from(bucket).upload(storagePath, file.bytes, { contentType: file.mimeType, upsert: false });
          if (error) throw error;
          savedPaths.push(storagePath);
          files.push({ fileName: file.fileName, mimeType: file.mimeType, size: file.size, storagePath });
        }
        const extractedText = prepared.map((file, index) => `FILE ${index + 1}: ${file.fileName}\n${redactMedicalText(file.extractedText).replace(/\0/g, "").trim()}`).join("\n\n");
        const record: MedicalRecord = { id, username: session.username, fileName: files.length === 1 ? files[0].fileName : `${files.length} files · ${files[0].fileName}`, mimeType: files[0].mimeType, size: files.reduce((n, f) => n + f.size, 0), storagePath: files[0].storagePath, files, extractedText, extractionStatus: prepared.every((f) => f.extractedText.trim()) ? "ready" : "needs_ocr", createdAt: new Date().toISOString() };
        await kv.set(`records:${session.username}:${id}`, record);
        const { extractedText: _text, storagePath: _path, files: originals, ...safeRecord } = record;
        return c.json({ record: { ...safeRecord, files: originals?.map(({ storagePath: _p, ...file }) => file) } }, 201);
      } catch (error) {
        if (savedPaths.length) await supabase.storage.from(bucket).remove(savedPaths);
        console.error("Batch upload failed", error);
        return c.json({ error: "Unable to save this upload. No partial record was created; please retry." }, 500);
      }
    }
    const fileName = safeFileName(payload.fileName?.trim() ?? "");
    const mimeType = payload.mimeType?.slice(0, 100) || "application/octet-stream";
    const size = Number(payload.size);
    if (
      !payload.base64 ||
      !Number.isFinite(size) ||
      size <= 0 ||
      size > maxFileBytes
    ) {
      return c.json({ error: "Choose a file no larger than 8 MB." }, 400);
    }

    let saveStage: "storage" | "database" = "storage";
    try {
      const bytes = decodeBase64(payload.base64);
      if (bytes.byteLength !== size || bytes.byteLength > maxFileBytes) {
        return c.json({ error: "The uploaded file is incomplete or too large." }, 400);
      }
      const id = crypto.randomUUID();
      const storagePath = `${session.username}/${id}/${storageFileName(fileName)}`;
      const supabase = storageClient();
      const { error: bucketError } = await supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: maxFileBytes,
      });
      if (bucketError && !/already exists/i.test(bucketError.message)) {
        throw bucketError;
      }
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
      if (uploadError) throw uploadError;

      const extractedText = redactMedicalText(payload.extractedText ?? "")
        .replace(/\0/g, "")
        .trim()
        .slice(0, maxExtractedCharacters);
      const record: MedicalRecord = {
        id,
        username: session.username,
        fileName,
        mimeType,
        size,
        storagePath,
        extractedText,
        extractionStatus: extractedText
          ? "ready"
          : mimeType.startsWith("image/")
            ? "needs_ocr"
            : "no_text",
        createdAt: new Date().toISOString(),
      };
      saveStage = "database";
      await kv.set(`records:${session.username}:${id}`, record);
      const { extractedText: _text, storagePath: _path, ...safeRecord } = record;
      return c.json({ record: safeRecord }, 201);
    } catch (error) {
      console.error(`Record upload failed at ${saveStage}`, error);
      return c.json({
        error: saveStage === "storage"
          ? "Unable to upload the file to secure storage. Please retry."
          : "Unable to save the uploaded file's record in the database. Please retry.",
      }, 500);
    }
  });
};
