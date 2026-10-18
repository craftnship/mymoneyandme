import "server-only";
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
  type AuthenticationResponseJSON, type RegistrationResponseJSON, type WebAuthnCredential,
} from "@simplewebauthn/server";
import { execute, newId, one, query, type Row } from "../db";
import { audit } from "./users";

/**
 * Passkeys (section 14): discoverable WebAuthn credentials so a member can sign
 * in with Face ID, fingerprint or a security key instead of a password.
 * Challenges live in the database for five minutes so they survive a restart.
 */
const RP_NAME = "My Money & Me";

function site() {
  const u = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://mymoneyandme.in");
  return { rpID: u.hostname, origin: u.origin };
}

export function passkeysConfigured() {
  return site().rpID !== "localhost" || process.env.NODE_ENV !== "production";
}

type PasskeyRow = Row & { id: string; user_id: string; public_key: Buffer; counter: number; transports: string | null; device_type: string | null; backed_up: number; name: string | null; created_at: Date; last_used_at: Date | null };

export type PasskeyInfo = { id: string; name: string | null; deviceType: string | null; backedUp: boolean; createdAt: Date; lastUsedAt: Date | null };

export async function listPasskeys(userId: string): Promise<PasskeyInfo[]> {
  const rows = await query<PasskeyRow>("SELECT id, name, device_type, backed_up, created_at, last_used_at FROM passkeys WHERE user_id = ? ORDER BY created_at", [userId]);
  return rows.map((r) => ({ id: r.id, name: r.name, deviceType: r.device_type, backedUp: Boolean(r.backed_up), createdAt: r.created_at, lastUsedAt: r.last_used_at }));
}

export async function deletePasskey(userId: string, id: string) {
  await execute("DELETE FROM passkeys WHERE id = ? AND user_id = ?", [id, userId]);
  await audit(userId, "passkeyRemoved", "passkey", id);
}

export async function renamePasskey(userId: string, id: string, name: string) {
  await execute("UPDATE passkeys SET name = ? WHERE id = ? AND user_id = ?", [name.trim().slice(0, 100) || null, id, userId]);
}

async function saveChallenge(challenge: string, purpose: "register" | "login", userId: string | null) {
  const id = newId();
  await execute("DELETE FROM webauthn_challenges WHERE expires_at < NOW()");
  await execute("INSERT INTO webauthn_challenges (id, user_id, challenge, purpose, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))", [id, userId, challenge, purpose]);
  return id;
}

async function takeChallenge(id: string, purpose: "register" | "login") {
  const row = await one<Row & { challenge: string; user_id: string | null }>("SELECT challenge, user_id FROM webauthn_challenges WHERE id = ? AND purpose = ? AND expires_at > NOW()", [id, purpose]);
  await execute("DELETE FROM webauthn_challenges WHERE id = ?", [id]);
  return row;
}

export async function registrationOptions(user: { id: string; email: string; name: string }) {
  const { rpID } = site();
  const existing = await query<PasskeyRow>("SELECT id, transports FROM passkeys WHERE user_id = ?", [user.id]);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: parseTransports(p.transports) })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  const challengeId = await saveChallenge(options.challenge, "register", user.id);
  return { options, challengeId };
}

export async function finishRegistration(userId: string, challengeId: string, response: RegistrationResponseJSON, name: string | null) {
  const { rpID, origin } = site();
  const c = await takeChallenge(challengeId, "register");
  if (!c || c.user_id !== userId) throw new Error("challengeExpired");
  const verification = await verifyRegistrationResponse({ response, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false });
  if (!verification.verified || !verification.registrationInfo) throw new Error("notVerified");
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await execute(
    "INSERT INTO passkeys (id, user_id, public_key, counter, transports, device_type, backed_up, name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [credential.id, userId, Buffer.from(credential.publicKey), credential.counter, (credential.transports ?? []).join(",") || null, credentialDeviceType, credentialBackedUp ? 1 : 0, name?.trim().slice(0, 100) || null],
  );
  await audit(userId, "passkeyAdded", "passkey", credential.id);
  return credential.id;
}

export async function authenticationOptions() {
  const { rpID } = site();
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred", allowCredentials: [] });
  const challengeId = await saveChallenge(options.challenge, "login", null);
  return { options, challengeId };
}

/** Verifies an assertion and returns the owning user id. */
export async function finishAuthentication(challengeId: string, response: AuthenticationResponseJSON): Promise<string> {
  const { rpID, origin } = site();
  const c = await takeChallenge(challengeId, "login");
  if (!c) throw new Error("challengeExpired");
  const row = await one<PasskeyRow>("SELECT id, user_id, public_key, counter, transports FROM passkeys WHERE id = ?", [response.id]);
  if (!row) throw new Error("unknownPasskey");
  const credential: WebAuthnCredential = { id: row.id, publicKey: new Uint8Array(row.public_key), counter: Number(row.counter), transports: parseTransports(row.transports) };
  const verification = await verifyAuthenticationResponse({ response, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpID, credential, requireUserVerification: false });
  if (!verification.verified) throw new Error("notVerified");
  await execute("UPDATE passkeys SET counter = ?, last_used_at = NOW() WHERE id = ?", [verification.authenticationInfo.newCounter, row.id]);
  await audit(row.user_id, "signInPasskey", "user", row.user_id);
  return row.user_id;
}

function parseTransports(s: string | null) {
  return s ? (s.split(",").filter(Boolean) as WebAuthnCredential["transports"]) : undefined;
}
