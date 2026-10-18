import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, PageTitle, Pill } from "@/components/ui";
import { requireHousehold } from "@/lib/auth/current";
import { archiveMemberAction } from "@/lib/data/actions";
import { listMembers } from "@/lib/data/store";

export async function generateMetadata() {
  const t = await getTranslations("appData.members");
  return { title: t("title"), robots: { index: false } };
}

export default async function MembersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("appData");
  return (
    <div className="max-w-2xl">
      <PageTitle title={t("members.title")} intro={t("members.intro")} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Link href="/app/data/members/new" className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong">{t("members.add")}</Link>
        <Link href="/app/data" className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-accent-soft">{t("common.back")}</Link>
      </div>
      <Suspense fallback={<p className="text-fg-muted">{t("common.loading")}</p>}>
        <List locale={locale} />
      </Suspense>
    </div>
  );
}

async function List({ locale }: { locale: string }) {
  const { household } = await requireHousehold(locale);
  const members = await listMembers(household.id);
  const t = await getTranslations("appData");
  return (
    <Card className="p-0">
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{m.name} {m.relation === "self" ? <span className="text-sm font-normal text-fg-muted">({t("members.you")})</span> : null}</p>
              <p className="text-sm text-fg-muted">{t(`options.relation.${m.relation}`)}{m.dob ? ` · ${m.dob}` : ""}</p>
            </div>
            <div className="flex gap-1.5">
              {m.earns ? <Pill tone="accent">{t("members.earns")}</Pill> : null}
              {m.dependant ? <Pill>{t("members.dependant")}</Pill> : null}
            </div>
            {m.relation !== "self" ? (
              <div className="flex items-center gap-2 text-sm">
                <Link href={`/app/data/members/${m.id}`} className="rounded-lg border border-border px-3 py-1 hover:bg-accent-soft">{t("common.edit")}</Link>
                <form action={archiveMemberAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className="rounded-lg border border-border px-3 py-1 text-danger hover:bg-danger-soft">{t("common.archive")}</button>
                </form>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {members.length <= 1 ? <p className="px-5 py-4 text-sm text-fg-muted">{t("members.empty")}</p> : null}
    </Card>
  );
}
