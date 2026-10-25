/**
 * Image checks for uploads, by content rather than by the name or the type
 * the browser claims. SVG is refused: it can carry scripts.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageInfo = { mime: "image/png" | "image/jpeg" | "image/webp"; width: number | null; height: number | null };

export function sniffImage(buf: Uint8Array): ImageInfo | null {
  const at = (i: number) => buf[i] ?? -1;
  const be16 = (i: number) => (at(i) << 8) | at(i + 1);
  const be32 = (i: number) => ((at(i) << 24) >>> 0) + (at(i + 1) << 16) + (at(i + 2) << 8) + at(i + 3);
  const le16 = (i: number) => at(i) | (at(i + 1) << 8);
  const le24 = (i: number) => at(i) | (at(i + 1) << 8) | (at(i + 2) << 16);

  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    return { mime: "image/png", width: be32(16), height: be32(20) };
  }
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    // Walk the segments to the first start-of-frame marker for the size.
    let i = 2;
    while (i + 9 < buf.length) {
      if (at(i) !== 0xff) { i++; continue; }
      const marker = at(i + 1);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mime: "image/jpeg", width: be16(i + 7), height: be16(i + 5) };
      }
      i += 2 + be16(i + 2);
    }
    return { mime: "image/jpeg", width: null, height: null };
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    const chunk = ascii(12, 16);
    if (chunk === "VP8X") return { mime: "image/webp", width: le24(24) + 1, height: le24(27) + 1 };
    if (chunk === "VP8 ") return { mime: "image/webp", width: le16(26) & 0x3fff, height: le16(28) & 0x3fff };
    if (chunk === "VP8L") {
      const b = [at(21), at(22), at(23), at(24)];
      return { mime: "image/webp", width: 1 + (((b[1] & 0x3f) << 8) | b[0]), height: 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)) };
    }
    return { mime: "image/webp", width: null, height: null };
  }
  return null;
}
