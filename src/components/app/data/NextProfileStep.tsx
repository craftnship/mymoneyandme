import { getTranslations } from "next-intl/server";
import type { User } from "@/lib/auth/users";
import { nextProfileStep, profileStepProgress } from "@/lib/data/profileSteps";
import { ProfileStepCard } from "./ProfileStepCard";

/** The next unanswered profile question, if any, with a line on why it helps. */
export async function NextProfileStep({ user }: { user: User }) {
  const step = nextProfileStep(user);
  if (!step) return null;
  const t = await getTranslations("appData");
  const { done, total } = profileStepProgress(user);
  return (
    <section aria-labelledby="next-step" className="space-y-2">
      <h2 id="next-step" className="text-lg font-semibold">{t("welcome.step.title")}</h2>
      <p className="text-sm text-fg-muted">{t("welcome.step.intro")}</p>
      <ProfileStepCard key={step} step={step} done={done} total={total} />
    </section>
  );
}
