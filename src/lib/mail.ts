import "server-only";

/**
 * Transactional mail over the site's own mailbox (hello@mymoneyandme.in on
 * Hostinger SMTP). Credentials come from the environment only. The display
 * name is added here so NEWSLETTER_FROM can stay a bare address.
 */
export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function fromAddress() {
  const raw = process.env.NEWSLETTER_FROM || process.env.SMTP_USER || "hello@mymoneyandme.in";
  return raw.includes("<") ? raw : `"My Money & Me" <${raw}>`;
}

export async function sendMail(msg: { to: string; subject: string; text: string; html: string }): Promise<void> {
  if (!mailConfigured()) throw new Error("SMTP is not configured");
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: fromAddress(), ...msg });
}

/** Plain, single-button HTML wrapper shared by every transactional email. */
export function emailLayout(lang: string, body: string, button: { label: string; url: string }, footer: string) {
  return `<!doctype html><html lang="${lang}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<p style="font-weight:600;font-size:18px">My Money &amp; Me</p>
<p>${body}</p>
<p><a href="${button.url}" style="display:inline-block;background:#0f6e56;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${button.label}</a></p>
<p style="font-size:13px;color:#666">${footer}</p>
<p style="font-size:12px;color:#888">${button.url}</p>
</body></html>`;
}
