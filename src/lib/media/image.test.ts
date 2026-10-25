import { describe, expect, it } from "vitest";
import { sniffImage } from "./image";

function png(w: number, h: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}

function jpeg(w: number, h: number) {
  // SOI, an APP0 segment of length 16, then SOF0 with height and width.
  const b = new Uint8Array(2 + 18 + 19);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0, 16], 0);
  const sof = 20;
  b.set([0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255], sof);
  return b;
}

describe("image sniffing", () => {
  it("reads PNG and JPEG sizes from their headers", () => {
    expect(sniffImage(png(1600, 900))).toEqual({ mime: "image/png", width: 1600, height: 900 });
    expect(sniffImage(jpeg(1200, 675))).toEqual({ mime: "image/jpeg", width: 1200, height: 675 });
  });

  it("recognises WebP", () => {
    const b = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8X" + "\0".repeat(20));
    expect(sniffImage(b)?.mime).toBe("image/webp");
  });

  it("refuses SVG, HTML and anything else, whatever the file is called", () => {
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffImage(new Uint8Array(0))).toBeNull();
  });
});
