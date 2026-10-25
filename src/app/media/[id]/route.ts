import { databaseConfigured } from "@/lib/db";
import { getImage } from "@/lib/media/store";

/** Uploaded images. Ids are random and never reused, so responses cache for a year. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = databaseConfigured() ? await getImage(id).catch(() => undefined) : undefined;
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
