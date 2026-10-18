import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))));
}

/**
 * Password hashing with scrypt (OWASP-recommended parameters, N=2^15), no
 * native dependency so it builds on the host. Format: scrypt$N$r$p$salt$hash.
 */
const N = 32768, R = 8, P = 1, KEYLEN = 32;

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }));
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB, hashB] = stored.split("$");
  if (alg !== "scrypt" || !saltB || !hashB) return false;
  const expected = Buffer.from(hashB, "base64url");
  const actual = (await scrypt(password.normalize("NFKC"), Buffer.from(saltB, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 }));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type PasswordProblem = "tooShort" | "tooLong" | "breached";

/**
 * Checks the password against Have I Been Pwned with the k-anonymity range API
 * (only the first five SHA-1 characters leave the server). A network failure
 * does not block sign-up; the check is a safeguard, not a gate.
 */
export async function checkPassword(password: string, { breachCheck = true } = {}): Promise<PasswordProblem | null> {
  if (password.length < PASSWORD_MIN) return "tooShort";
  if (password.length > PASSWORD_MAX) return "tooLong";
  if (!breachCheck) return null;
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, { headers: { "Add-Padding": "true" }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const suffix = sha1.slice(5);
    const hit = (await res.text()).split("\n").some((line) => line.startsWith(suffix) && Number(line.split(":")[1]) > 0);
    return hit ? "breached" : null;
  } catch {
    return null;
  }
}
