import "server-only";
import { updateUser } from "../auth/users";
import { listMembers } from "./store";

/**
 * users.dependants mirrors the number of household members marked dependant,
 * so the check-up and the quick start read one number. Call after every
 * member change.
 */
export async function syncDependants(householdId: string, ownerUserId: string): Promise<number> {
  const members = await listMembers(householdId);
  const count = members.filter((m) => m.relation !== "self" && m.dependant).length;
  await updateUser(ownerUserId, { dependants: count });
  return count;
}
