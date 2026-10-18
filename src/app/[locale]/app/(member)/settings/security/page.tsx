import { Suspense } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, Pill } from "@/components/ui";
import { AddPasskey } from "@/components/app/Passkeys";
import { ResendVerification } from "@/components/app/ResendVerification";
import { ChangePasswordForm, PasskeyControls, RevokeSessionButton, SignOutElsewhereForm } from "@/components/app/settings/SecurityForms";
import { requireUser } from "@/lib/auth/current";
import { listSessions } from "@/lib/auth/session";
import { getPasswordHash } from "@/lib/auth/users";
import { listPasskeys } from "@/lib/auth/webauthn";
import { approximateIp, describeDevice } from "@/lib/account/device";

export async function generateMetadata() {
  const t = await getTranslations("appSettings");
  return { title: `${t("nav.security")} · ${t("title")}`, robots: { index: false } };
}

async function Security({ locale }: { locale: string }) {
  const user = await requireUser(locale);
  const [hash, sessions, passkeys] = await Promise.all([getPasswordHash(user.id), listSessions(user.id), listPasskeys(user.id)]);
  const t = await getTranslations("appSettings.security");
  const f = await getFormatter();
  const when = (d: Date) => f.dateTime(d, { dateStyle: "medium", timeStyle: "short" });
  const others = sessions.filter((s) => !s.current).length;
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-semibold">{t("email")}</h2>
        <p className="mt-2 text-sm">
          <span className="me-2">{user.email}</span>
          {user.emailVerifiedAt ? <Pill tone="accent">{t("verified")}</Pill> : <Pill tone="warn">{t("unverified")}</Pill>}
        </p>
        {!user.emailVerifiedAt ? <p className="mt-2 text-sm text-fg-muted">{t("verifyHint")} <ResendVerification /></p> : null}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">{t("password")}</h2>
        <p className="mt-2 mb-4 text-sm text-fg-muted">{t("passwordIntro")}</p>
        <ChangePasswordForm hasPassword={Boolean(hash)} />
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">{t("sessions")}</h2>
        <p className="mt-2 mb-4 text-sm text-fg-muted">{t("sessionsIntro")}</p>
        <ul className="divide-y divide-border">
          {sessions.map((s) => {
            const d = describeDevice(s.userAgent);
            const ip = approximateIp(s.ip);
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-medium">
                    {t("device", { browser: d.browser === "unknown" ? t("unknownBrowser") : d.browser, platform: d.platform === "unknown" ? t("unknownPlatform") : d.platform })}
                    {s.current ? <span className="ms-2"><Pill tone="accent">{t("thisDevice")}</Pill></span> : null}
                  </p>
                  <p className="text-fg-muted">
                    {t("lastSeen", { when: when(s.lastSeenAt) })}{ip ? ` · ${t("approxIp", { ip })}` : ""} · {t("signedInSince", { when: when(s.createdAt) })}
                  </p>
                </div>
                {s.current ? null : <RevokeSessionButton sessionId={s.id} />}
              </li>
            );
          })}
        </ul>
        <div className="mt-4">
          <SignOutElsewhereForm others={others} />
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">{t("passkeys")}</h2>
        <p className="mt-2 mb-4 text-sm text-fg-muted">{t("passkeysIntro")}</p>
        {passkeys.length ? (
          <ul className="divide-y divide-border mb-4">
            {passkeys.map((p) => {
              const name = p.name ?? t("unnamedPasskey");
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="text-sm">
                    <p className="font-medium">
                      {name}
                      {p.backedUp ? <span className="ms-2"><Pill>{t("synced")}</Pill></span> : null}
                    </p>
                    <p className="text-fg-muted">
                      {t("added", { when: when(p.createdAt) })}{p.lastUsedAt ? ` · ${t("lastUsed", { when: when(p.lastUsedAt) })}` : ""}
                    </p>
                  </div>
                  <PasskeyControls passkeyId={p.id} name={name} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-fg-muted">{t("noPasskeys")}</p>
        )}
        <AddPasskey />
      </Card>
    </div>
  );
}

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-fg-muted">{t("loading")}</p>}>
      <Security locale={locale} />
    </Suspense>
  );
}
