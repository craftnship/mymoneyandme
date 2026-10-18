import "server-only";
import { emailLayout, sendMail } from "../mail";

/**
 * Account emails (verification, password reset, deletion confirmation). Copy
 * lives here because it is sent rather than rendered; English and Tamil ship
 * first, other languages fall back to English until reviewed.
 */
type Copy = { subject: string; body: string; button: string; ignore: string };

const VERIFY: Record<string, Copy> = {
  en: {
    subject: "Confirm your email for My Money & Me",
    body: "Welcome. Confirm your email address so you can recover your account and receive your check-up reminders.",
    button: "Confirm email",
    ignore: "If you did not create an account, ignore this email and nothing will happen.",
  },
  ta: {
    subject: "My Money & Me-க்கான உங்கள் மின்னஞ்சலை உறுதிப்படுத்துங்கள்",
    body: "வரவேற்கிறோம். உங்கள் கணக்கை மீட்டெடுக்கவும் செக்-அப் நினைவூட்டல்களைப் பெறவும் உங்கள் மின்னஞ்சல் முகவரியை உறுதிப்படுத்துங்கள்.",
    button: "மின்னஞ்சலை உறுதிப்படுத்து",
    ignore: "நீங்கள் கணக்கு உருவாக்கவில்லை என்றால், இந்த மின்னஞ்சலைப் புறக்கணியுங்கள்; எதுவும் நடக்காது.",
  },
};

const RESET: Record<string, Copy> = {
  en: {
    subject: "Reset your My Money & Me password",
    body: "Someone asked to reset the password for this account. The link works for one hour and can be used once.",
    button: "Choose a new password",
    ignore: "If this was not you, ignore this email. Your password stays as it is.",
  },
  ta: {
    subject: "உங்கள் My Money & Me கடவுச்சொல்லை மீட்டமைக்கவும்",
    body: "இந்தக் கணக்கின் கடவுச்சொல்லை மீட்டமைக்க யாரோ கேட்டுள்ளனர். இந்த இணைப்பு ஒரு மணி நேரம் செயல்படும்; ஒரு முறை மட்டுமே பயன்படுத்தலாம்.",
    button: "புதிய கடவுச்சொல்லைத் தேர்வுசெய்",
    ignore: "இது நீங்கள் இல்லையென்றால், இந்த மின்னஞ்சலைப் புறக்கணியுங்கள். உங்கள் கடவுச்சொல் அப்படியே இருக்கும்.",
  },
};

const DELETE: Record<string, Copy> = {
  en: {
    subject: "Confirm deleting your My Money & Me account",
    body: "You asked to delete your account. Confirm with the button below. Your data is removed after a 30-day grace period; signing in before then cancels the deletion.",
    button: "Confirm deletion",
    ignore: "If this was not you, change your password now and ignore this email.",
  },
  ta: {
    subject: "உங்கள் My Money & Me கணக்கை நீக்குவதை உறுதிப்படுத்துங்கள்",
    body: "உங்கள் கணக்கை நீக்கக் கேட்டுள்ளீர்கள். கீழே உள்ள பொத்தானால் உறுதிப்படுத்துங்கள். 30 நாள் கால அவகாசத்திற்குப் பிறகு உங்கள் தரவு நீக்கப்படும்; அதற்குள் உள்நுழைந்தால் நீக்கம் ரத்தாகும்.",
    button: "நீக்கத்தை உறுதிப்படுத்து",
    ignore: "இது நீங்கள் இல்லையென்றால், இப்போதே உங்கள் கடவுச்சொல்லை மாற்றி இந்த மின்னஞ்சலைப் புறக்கணியுங்கள்.",
  },
};

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mymoneyandme.in").replace(/\/$/, "");
}

async function send(to: string, locale: string, copy: Record<string, Copy>, url: string) {
  const c = copy[locale] ?? copy.en;
  const text = `${c.body}\n\n${c.button}: ${url}\n\n${c.ignore}`;
  await sendMail({ to, subject: c.subject, text, html: emailLayout(locale, c.body, { label: c.button, url }, c.ignore) });
}

export function sendVerificationEmail(to: string, locale: string, token: string) {
  return send(to, locale, VERIFY, `${siteUrl()}/api/auth/verify?token=${token}&locale=${locale}`);
}

export function sendPasswordResetEmail(to: string, locale: string, token: string) {
  return send(to, locale, RESET, `${siteUrl()}/${locale}/app/reset?token=${token}`);
}

export function sendDeletionEmail(to: string, locale: string, token: string) {
  return send(to, locale, DELETE, `${siteUrl()}/api/auth/verify?token=${token}&purpose=delete&locale=${locale}`);
}
