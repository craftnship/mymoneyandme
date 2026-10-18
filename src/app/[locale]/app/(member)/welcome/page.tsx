import { redirect } from "@/i18n/navigation";

/** Onboarding quick start lands here after sign-up; replaced by the guided flow. */
export default async function WelcomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/app", locale });
}
