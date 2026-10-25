import { confirm } from "@/lib/newsletter";
import { getStore } from "@/lib/newsletter/store";
import { seeOther } from "@/lib/redirect";

/** Confirmation link target: flips the subscriber on, then lands on a localised status page. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const store = await getStore();
  const result = store ? await confirm(store, token).catch(() => ({ outcome: "invalid" as const, locale: "en" })) : { outcome: "invalid" as const, locale: "en" };
  return seeOther(`/${result.locale}/newsletter?status=${result.outcome}`);
}
