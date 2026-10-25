import "server-only";
import { execute, newId, one, type Row } from "../db";
import { MAX_IMAGE_BYTES, sniffImage } from "./image";

export type UploadError = "empty" | "tooLarge" | "notAnImage";

/** Stores an uploaded image and returns the path pages use for it. */
export async function saveImage(file: File, userId: string): Promise<{ ok: true; url: string } | { ok: false; error: UploadError }> {
  if (!file || file.size === 0) return { ok: false, error: "empty" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "tooLarge" };
  const buf = new Uint8Array(await file.arrayBuffer());
  const info = sniffImage(buf);
  if (!info) return { ok: false, error: "notAnImage" };
  const id = newId();
  await execute(
    "INSERT INTO media (id, file_name, mime, bytes, width, height, data, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, (file.name || "image").slice(0, 255), info.mime, buf.length, info.width, info.height, Buffer.from(buf), userId],
  );
  return { ok: true, url: `/media/${id}` };
}

export async function getImage(id: string): Promise<{ mime: string; data: Buffer } | undefined> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
  const row = await one<Row & { mime: string; data: Buffer }>("SELECT mime, data FROM media WHERE id = ?", [id]);
  return row ? { mime: row.mime, data: row.data } : undefined;
}
