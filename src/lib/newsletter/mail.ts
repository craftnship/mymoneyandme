import type { Mailer } from "./index";
import type { Subscriber } from "./store";

/**
 * Transactional mail over the site's own mailbox (hello@mymoneyandme.in on
 * Hostinger). Credentials come from the environment only; nothing is written
 * to the repository. Copy lives here rather than in messages/ because it is
 * sent, not rendered, and only two languages ship for now.
 */
const COPY: Record<string, { subject: string; body: (url: string) => string; button: string; ignore: string }> = {
  en: {
    subject: "Confirm your My Money & Me subscription",
    body: () => "Thanks for signing up. Confirm your address to get the weekly digest of new articles, chapters and calculators. We never share your email.",
    button: "Confirm subscription",
    ignore: "If you did not sign up, ignore this email and nothing will be sent.",
  },
  ta: {
    subject: "உங்கள் My Money & Me சந்தாவை உறுதிப்படுத்துங்கள்",
    body: () => "பதிவு செய்ததற்கு நன்றி. புதிய கட்டுரைகள், அத்தியாயங்கள் மற்றும் கால்குலேட்டர்களின் வாராந்திர தொகுப்பைப் பெற உங்கள் முகவரியை உறுதிப்படுத்துங்கள். உங்கள் மின்னஞ்சலை நாங்கள் ஒருபோதும் பகிர மாட்டோம்.",
    button: "சந்தாவை உறுதிப்படுத்து",
    ignore: "நீங்கள் பதிவு செய்யவில்லை என்றால், இந்த மின்னஞ்சலைப் புறக்கணியுங்கள்; எதுவும் அனுப்பப்படாது.",
  },
};

export function confirmationEmail(sub: Subscriber, confirmUrl: string) {
  const c = COPY[sub.locale] ?? COPY.en;
  const text = `${c.body(confirmUrl)}\n\n${c.button}: ${confirmUrl}\n\n${c.ignore}`;
  const html = `<!doctype html><html lang="${sub.locale}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<p style="font-weight:600;font-size:18px">My Money &amp; Me</p>
<p>${c.body(confirmUrl)}</p>
<p><a href="${confirmUrl}" style="display:inline-block;background:#0f6e56;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${c.button}</a></p>
<p style="font-size:13px;color:#666">${c.ignore}</p>
<p style="font-size:12px;color:#888">${confirmUrl}</p>
</body></html>`;
  return { subject: c.subject, text, html };
}

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.NEWSLETTER_FROM);
}

export async function getMailer(): Promise<Mailer | undefined> {
  if (!smtpConfigured()) return undefined;
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const from = process.env.NEWSLETTER_FROM!;
  return {
    async sendConfirmation(sub, confirmUrl) {
      const m = confirmationEmail(sub, confirmUrl);
      await transport.sendMail({ from, to: sub.email, subject: m.subject, text: m.text, html: m.html });
    },
  };
}
