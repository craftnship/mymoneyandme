import "server-only";
import type { Family } from "./model";
import { listItems, listMembers } from "./store";

/** Select options for the item form: household members, and loans an asset can link to. */
export async function formOptions(householdId: string, family: Family) {
  const members = (await listMembers(householdId)).map((m) => ({ id: m.id, name: m.name }));
  const loans = family === "assets" ? (await listItems(householdId, "loans")).map((l) => ({ id: l.id, name: l.payload.label || l.type })) : [];
  return { members, loans };
}
