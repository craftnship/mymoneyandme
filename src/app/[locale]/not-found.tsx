import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <h1 className="text-3xl font-semibold">{t("notFound")}</h1>
      <p className="mt-3 text-fg-muted">{t("notFoundBody")}</p>
      <Link href="/" className="inline-block mt-6 rounded-lg bg-accent text-white px-5 py-2.5 font-medium">{t("goHome")}</Link>
    </div>
  );
}
