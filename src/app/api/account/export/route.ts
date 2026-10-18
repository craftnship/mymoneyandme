import { NextResponse } from "next/server";
import { getCurrentHousehold, getCurrentUser } from "@/lib/auth/current";
import { audit } from "@/lib/auth/users";
import { buildExport, exportItems, itemsToCsv } from "@/lib/account/export";

/**
 * Data export (section 14): GET returns the signed-in member's complete data
 * as a JSON download, or their financial items as CSV with `?format=csv`.
 * The session cookie is the only credential; there is no user id parameter.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "signedOut" }, { status: 401 });
  const household = await getCurrentHousehold(user.id);
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const stamp = new Date().toISOString().slice(0, 10);
  const headers: Record<string, string> = { "cache-control": "no-store, private", "x-content-type-options": "nosniff" };
  if (format === "csv") {
    const csv = itemsToCsv(await exportItems(household.id));
    await audit(user.id, "dataExported", "household", household.id);
    return new NextResponse(csv, {
      headers: { ...headers, "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="mymoneyandme-items-${stamp}.csv"` },
    });
  }
  const body = JSON.stringify(await buildExport(user, household), null, 2);
  await audit(user.id, "dataExported", "household", household.id);
  return new NextResponse(body, {
    headers: { ...headers, "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="mymoneyandme-export-${stamp}.json"` },
  });
}
