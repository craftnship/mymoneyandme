import "server-only";
import { databaseConfigured } from "../db";
import { readJsonContent, type ContentSnapshot } from "./json";
import { loadFromDb, syncFromJson } from "./db";

export type ContentSource = { snapshot: ContentSnapshot; from: "database" | "files"; problem?: string };

let synced: Promise<unknown> | undefined;

/**
 * Reads content from the database, syncing the JSON files into it once per
 * process. Falls back to the files when DATABASE_URL is not set or the
 * database cannot be reached, so the public site never depends on MySQL
 * being up (and the Hostinger build works without database access).
 */
export async function loadContent(): Promise<ContentSource> {
  const json = readJsonContent();
  if (!databaseConfigured()) return { snapshot: json, from: "files", problem: "notConfigured" };
  try {
    if (!synced) synced = syncFromJson(json).catch((e) => { synced = undefined; throw e; });
    await synced;
    return { snapshot: await loadFromDb(), from: "database" };
  } catch (e) {
    console.error("Content: database unavailable, serving the JSON files", e);
    return { snapshot: json, from: "files", problem: "unavailable" };
  }
}
