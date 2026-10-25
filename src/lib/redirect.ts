/**
 * A 303 to a path on this site. The Location stays relative because behind
 * Hostinger's proxy `req.url` carries the internal bind address
 * (0.0.0.0:3000), not the public host; browsers resolve a relative Location
 * against the address they actually requested.
 */
export function seeOther(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path } });
}
