import "server-only";
import { query, type Row } from "../db";

/**
 * Usage report for the admin (companion spec section 29). Member activity is
 * counted from audit_events, anonymous public activity from events. Nothing
 * here reads an amount or a name: the report is counts and distinct actors.
 *
 * North-star metric: members who completed at least one meaningful planning
 * action in the month (a check-up, a plan step, a goal, or a data update).
 */
export const MEANINGFUL_ACTIONS = ["checkUpRun", "plan.done", "plan.inProgress", "goalCreated", "goalUpdated", "itemCreated", "itemUpdated", "quickStart"] as const;

export type WindowCounts = {
  signUps: number;
  activePlanners: number;
  signedIn: number;
  checkUps: number;
  stepsDone: number;
  goalsCreated: number;
  itemsSaved: number;
  calculatorRuns: number;
  quickChecks: number;
};

export type UsageReport = {
  generatedAt: string;
  last30: WindowCounts;
  previous30: WindowCounts;
  months: { month: string; northStar: number; signUps: number; checkUps: number; calculatorRuns: number }[];
  activation: { signedUp: number; ranCheckUp: number; createdGoal: number; medianHoursToCheckUp: number | null };
  topCalculators: { slug: string; runs: number }[];
};

type CountRow = Row & { n: number };

async function count(sql: string, params: unknown[]): Promise<number> {
  const r = await query<CountRow>(sql, params);
  return Number(r[0]?.n ?? 0);
}

async function windowCounts(from: Date, to: Date): Promise<WindowCounts> {
  const p = [from, to];
  const placeholders = MEANINGFUL_ACTIONS.map(() => "?").join(", ");
  const [signUps, activePlanners, signedIn, checkUps, stepsDone, goalsCreated, itemsSaved, calculatorRuns, quickChecks] = await Promise.all([
    count("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'signUp' AND at >= ? AND at < ?", p),
    count(`SELECT COUNT(DISTINCT actor_user_id) AS n FROM audit_events WHERE action IN (${placeholders}) AND actor_user_id IS NOT NULL AND at >= ? AND at < ?`, [...MEANINGFUL_ACTIONS, ...p]),
    count("SELECT COUNT(DISTINCT actor_user_id) AS n FROM audit_events WHERE action IN ('signIn', 'signInPasskey') AND at >= ? AND at < ?", p),
    count("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'checkUpRun' AND at >= ? AND at < ?", p),
    count("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'plan.done' AND at >= ? AND at < ?", p),
    count("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'goalCreated' AND at >= ? AND at < ?", p),
    count("SELECT COUNT(*) AS n FROM audit_events WHERE action IN ('itemCreated', 'itemUpdated') AND at >= ? AND at < ?", p),
    count("SELECT COUNT(*) AS n FROM events WHERE name = 'calculatorUsed' AND at >= ? AND at < ?", p),
    count("SELECT COUNT(*) AS n FROM events WHERE name = 'quickCheckRun' AND at >= ? AND at < ?", p),
  ]);
  return { signUps, activePlanners, signedIn, checkUps, stepsDone, goalsCreated, itemsSaved, calculatorRuns, quickChecks };
}

const DAY = 24 * 3600 * 1000;

export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** The first day of each of the last `n` months, oldest first. */
export function lastMonths(n: number, now: Date): Date[] {
  const out: Date[] = [];
  for (let k = n - 1; k >= 0; k--) out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1)));
  return out;
}

export async function usageReport(now = new Date()): Promise<UsageReport> {
  const d30 = new Date(now.getTime() - 30 * DAY);
  const d60 = new Date(now.getTime() - 60 * DAY);
  const d90 = new Date(now.getTime() - 90 * DAY);
  const starts = lastMonths(6, now);
  const since = starts[0];
  const placeholders = MEANINGFUL_ACTIONS.map(() => "?").join(", ");

  type MonthRow = Row & { month: string; n: number };
  const [last30, previous30, northStar, signUps, checkUps, calcRuns, topCalculators, activationRows, firstCheckUps] = await Promise.all([
    windowCounts(d30, now),
    windowCounts(d60, d30),
    query<MonthRow>(`SELECT DATE_FORMAT(at, '%Y-%m') AS month, COUNT(DISTINCT actor_user_id) AS n FROM audit_events WHERE action IN (${placeholders}) AND actor_user_id IS NOT NULL AND at >= ? GROUP BY month`, [...MEANINGFUL_ACTIONS, since]),
    query<MonthRow>("SELECT DATE_FORMAT(at, '%Y-%m') AS month, COUNT(*) AS n FROM audit_events WHERE action = 'signUp' AND at >= ? GROUP BY month", [since]),
    query<MonthRow>("SELECT DATE_FORMAT(at, '%Y-%m') AS month, COUNT(*) AS n FROM audit_events WHERE action = 'checkUpRun' AND at >= ? GROUP BY month", [since]),
    query<MonthRow>("SELECT DATE_FORMAT(at, '%Y-%m') AS month, COUNT(*) AS n FROM events WHERE name = 'calculatorUsed' AND at >= ? GROUP BY month", [since]),
    query<Row & { slug: string; runs: number }>("SELECT detail AS slug, COUNT(*) AS runs FROM events WHERE name = 'calculatorUsed' AND detail IS NOT NULL AND at >= ? GROUP BY detail ORDER BY runs DESC, detail LIMIT 10", [d30]),
    // Activation: everyone who signed up in the last 90 days, and whether they went on to a check-up or a goal.
    query<Row & { signed_up: number; ran: number; goal: number }>(
      `SELECT COUNT(*) AS signed_up,
        SUM(EXISTS (SELECT 1 FROM audit_events c WHERE c.actor_user_id = s.actor_user_id AND c.action = 'checkUpRun')) AS ran,
        SUM(EXISTS (SELECT 1 FROM audit_events g WHERE g.actor_user_id = s.actor_user_id AND g.action = 'goalCreated')) AS goal
       FROM audit_events s WHERE s.action = 'signUp' AND s.at >= ?`,
      [d90],
    ),
    query<Row & { hours: number }>(
      `SELECT TIMESTAMPDIFF(SECOND, s.at, MIN(c.at)) / 3600 AS hours
       FROM audit_events s JOIN audit_events c ON c.actor_user_id = s.actor_user_id AND c.action = 'checkUpRun' AND c.at >= s.at
       WHERE s.action = 'signUp' AND s.at >= ? GROUP BY s.id, s.at`,
      [d90],
    ),
  ]);

  const byMonth = (rows: MonthRow[]) => new Map(rows.map((r) => [r.month, Number(r.n)]));
  const ns = byMonth(northStar), su = byMonth(signUps), cu = byMonth(checkUps), cr = byMonth(calcRuns);
  const months = starts.map((d) => {
    const month = monthKey(d);
    return { month, northStar: ns.get(month) ?? 0, signUps: su.get(month) ?? 0, checkUps: cu.get(month) ?? 0, calculatorRuns: cr.get(month) ?? 0 };
  });

  const hours = firstCheckUps.map((r) => Number(r.hours)).filter((h) => Number.isFinite(h)).sort((a, b) => a - b);
  const medianHoursToCheckUp = hours.length ? hours[Math.floor(hours.length / 2)] : null;
  const a = activationRows[0];

  return {
    generatedAt: now.toISOString(),
    last30,
    previous30,
    months,
    activation: { signedUp: Number(a?.signed_up ?? 0), ranCheckUp: Number(a?.ran ?? 0), createdGoal: Number(a?.goal ?? 0), medianHoursToCheckUp },
    topCalculators: topCalculators.map((r) => ({ slug: r.slug, runs: Number(r.runs) })),
  };
}
