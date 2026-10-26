import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { requireStaff } from "@/lib/auth/admin";
import { audit } from "@/lib/auth/users";
import { databaseConfigured } from "@/lib/db";
import { loadFromDb } from "@/lib/content/db";

/**
 * "Export all content": every live article, module with its chapters, and
 * news item, drafts included, in the same shape as the files under
 * /content. A backup, and a way to commit a snapshot to Git. Staff with a
 * passkey session only; anyone else gets a 404 like the console itself.
 * Uploaded images are referenced by their /media links, not included.
 */
export async function GET(req: Request) {
  const locale = new URL(req.url).searchParams.get("locale") === "ta" ? "ta" : "en";
  let staff;
  try {
    staff = await requireStaff(locale);
  } catch (e) {
    // requireUser redirects a signed-out visitor to sign-in; let that through.
    unstable_rethrow(e);
    return new NextResponse("Not found", { status: 404 });
  }
  if (!databaseConfigured()) return NextResponse.json({ error: "notConfigured" }, { status: 503 });
  const snapshot = await loadFromDb();
  const stamp = new Date().toISOString().slice(0, 10);
  await audit(staff.user.id, "contentExported", "content");
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), ...snapshot }, null, 2), {
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mymoneyandme-content-${stamp}.json"`,
    },
  });
}
