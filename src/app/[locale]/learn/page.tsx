import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { modulesForTrack } from "@/lib/content/store";
import { Card, PageTitle } from "@/components/ui";

export async function generateMetadata() {
  const t = await getTranslations("learn");
  return { title: t("title"), description: t("intro") };
}

export default async function LearnPage() {
  const t = await getTranslations("learn");
  const tracks = ["adults", "kids", "women"] as const;
  return (
    <div>
      <PageTitle title={t("title")} intro={t("intro")} />
      <div className="grid gap-4 md:grid-cols-3">
        {tracks.map((track) => {
          const mods = modulesForTrack(track);
          const chapters = mods.reduce((s, m) => s + m.chapters.length, 0);
          return (
            <Link key={track} href={`/learn/${track}`} className="block">
              <Card className="h-full hover:border-accent transition-colors">
                <h2 className="text-2xl font-semibold">{t(`track.${track}.title`)}</h2>
                <p className="mt-2 text-fg-muted">{t(`track.${track}.body`)}</p>
                <p className="mt-4 text-sm text-fg-muted">{t("modules", { count: mods.length })} · {t("chapters", { count: chapters })}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
