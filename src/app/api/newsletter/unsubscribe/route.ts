import { unsubscribe } from "@/lib/newsletter";
import { getStore } from "@/lib/newsletter/store";
import { seeOther } from "@/lib/redirect";

/** One-click unsubscribe link carried in every digest. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const store = await getStore();
  const result = store ? await unsubscribe(store, token).catch(() => ({ outcome: "invalid" as const, locale: "en" })) : { outcome: "invalid" as const, locale: "en" };
  return seeOther(`/${result.locale}/newsletter?status=${result.outcome}`);
}
