import "server-only";
import { query, type Row } from "../db";
import { decryptJson } from "../db/crypto";
import { currentConsents, type User } from "../auth/users";
import { getHealthFlags } from "./store";

/**
 * One-click data export (section 14). The JSON holds everything the member
 * owns, decrypted; the CSV flattens financial items to one row each so the
 * figures open in a spreadsheet. Archived rows are included and flagged so
 * the export really is complete.
 */
type ItemRow = Row & { id: string; family: string; type: string; member_id: string | null; payload_enc: string; confidence: string; archived_at: Date | null; created_at: Date; updated_at: Date };
type GoalRow = Row & { id: string; member_id: string | null; template: string; name: string; target_date: Date | string; priority: string; flexibility_years: number; payload_enc: string; created_at: Date; updated_at: Date; archived_at: Date | null };
type CheckupRow = Row & { id: string; rulepack_version: string; inputs_enc: string; result_enc: string; overall: number; grade: string; confidence: string; created_at: Date };

export type ExportedItem = { id: string; family: string; type: string; memberId: string | null; confidence: string; archivedAt: Date | null; createdAt: Date; updatedAt: Date; payload: Record<string, unknown> };

function safeDecrypt(sealed: string): unknown {
  try {
    return decryptJson<unknown>(sealed);
  } catch {
    return { error: "undecryptable" };
  }
}

function dateOnly(v: Date | string | null): string | null {
  return v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null;
}

export async function exportItems(householdId: string): Promise<ExportedItem[]> {
  const rows = await query<ItemRow>("SELECT * FROM financial_items WHERE household_id = ? ORDER BY family, created_at", [householdId]);
  return rows.map((r) => ({
    id: r.id, family: r.family, type: r.type, memberId: r.member_id, confidence: r.confidence, archivedAt: r.archived_at, createdAt: r.created_at, updatedAt: r.updated_at,
    payload: (safeDecrypt(r.payload_enc) ?? {}) as Record<string, unknown>,
  }));
}

export async function buildExport(user: User, household: { id: string; name: string }) {
  const [members, items, goals, checkups, planItems, consentHistory, consents, health] = await Promise.all([
    query<Row>("SELECT id, name, relation, dob, earns, dependant, created_at, archived_at FROM household_members WHERE household_id = ? ORDER BY created_at", [household.id]),
    exportItems(household.id),
    query<GoalRow>("SELECT * FROM goals WHERE household_id = ? ORDER BY created_at", [household.id]),
    query<CheckupRow>("SELECT * FROM checkups WHERE household_id = ? ORDER BY created_at", [household.id]),
    query<Row>("SELECT item_id, status, skip_reason, snoozed_until, updated_at FROM plan_items WHERE household_id = ? ORDER BY item_id", [household.id]),
    query<Row>("SELECT kind, granted, recorded_at FROM consents WHERE user_id = ? ORDER BY recorded_at, id", [user.id]),
    currentConsents(user.id),
    getHealthFlags(user.id),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    format: "mymoneyandme/1",
    profile: {
      id: user.id, email: user.email, emailVerifiedAt: user.emailVerifiedAt, name: user.name, preferredName: user.preferredName, dob: user.dob, gender: user.gender,
      maritalStatus: user.maritalStatus, dependants: user.dependants, city: user.city, state: user.state, pin: user.pin, cityTier: user.cityTier, locale: user.locale,
      numberFormat: user.numberFormat, employment: user.employment, retirementAge: user.retirementAge, riskProfile: user.riskProfile, hasTermCover: user.hasTermCover, hasHealthCover: user.hasHealthCover, hasWill: user.hasWill, smoker: health.smoker,
      existingConditions: health.existingConditions, deletionRequestedAt: user.deletionRequestedAt, createdAt: user.createdAt,
    },
    household: { id: household.id, name: household.name },
    members: members.map((m) => ({ id: m.id, name: m.name, relation: m.relation, dob: dateOnly(m.dob), earns: Boolean(m.earns), dependant: Boolean(m.dependant), createdAt: m.created_at, archivedAt: m.archived_at })),
    financialItems: items,
    goals: goals.map((g) => ({
      id: g.id, memberId: g.member_id, template: g.template, name: g.name, targetDate: dateOnly(g.target_date), priority: g.priority, flexibilityYears: g.flexibility_years,
      payload: safeDecrypt(g.payload_enc), createdAt: g.created_at, updatedAt: g.updated_at, archivedAt: g.archived_at,
    })),
    checkUps: checkups.map((c) => ({
      id: c.id, rulepackVersion: c.rulepack_version, overall: c.overall, grade: c.grade, confidence: c.confidence, createdAt: c.created_at,
      inputs: safeDecrypt(c.inputs_enc), result: safeDecrypt(c.result_enc),
    })),
    planItems: planItems.map((p) => ({ itemId: p.item_id, status: p.status, skipReason: p.skip_reason, snoozedUntil: dateOnly(p.snoozed_until), updatedAt: p.updated_at })),
    consents: { current: consents, history: consentHistory.map((c) => ({ kind: c.kind, granted: Boolean(c.granted), recordedAt: c.recorded_at })) },
  };
}

const FIXED_COLUMNS = ["id", "family", "type", "memberId", "confidence", "createdAt", "updatedAt", "archivedAt"] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(";") : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per financial item; payload keys become columns (union across all items, sorted). */
export function itemsToCsv(items: ExportedItem[]): string {
  const payloadKeys = Array.from(new Set(items.flatMap((i) => Object.keys(i.payload)))).sort();
  const header = [...FIXED_COLUMNS, ...payloadKeys];
  const lines = items.map((i) => [...FIXED_COLUMNS.map((c) => csvCell(i[c])), ...payloadKeys.map((k) => csvCell(i.payload[k]))].join(","));
  return `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`;
}
