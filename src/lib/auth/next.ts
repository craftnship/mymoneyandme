/**
 * Where to go after signing in: only the member app and the admin in the
 * same language, so a crafted ?next= cannot send anyone off-site.
 */
export function safeNext(next: string | undefined | null, locale: string): string | undefined {
  if (!next) return undefined;
  return next.startsWith(`/${locale}/app`) || next.startsWith(`/${locale}/admin`) ? next : undefined;
}
