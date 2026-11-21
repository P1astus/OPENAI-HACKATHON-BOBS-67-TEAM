const DAY_MS = 24 * 60 * 60 * 1000;

export const nowIso = () => new Date().toISOString();
export const addDays = (iso: string | number, days: number) =>
  new Date((typeof iso === "string" ? Date.parse(iso) : iso) + days * DAY_MS).toISOString();
export const addMinutes = (iso: string, minutes: number) =>
  new Date(Date.parse(iso) + minutes * 60_000).toISOString();
export const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export const BERLIN_TIME_ZONE = "Europe/Berlin";
const berlinParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: BERLIN_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const berlinOffset = new Intl.DateTimeFormat("en-GB", { timeZone: BERLIN_TIME_ZONE, timeZoneName: "longOffset" });

// Use UTC calendar arithmetic on Berlin's date fields to advance days without crossing DST.
function berlinCivilDay(from: number): number {
  const parts = berlinParts.formatToParts(from);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"));
}

export const berlinDate = (from: number) => new Date(berlinCivilDay(from)).toISOString().slice(0, 10);

function offsetMinutes(at: number): number {
  const offset = berlinOffset.formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
  return match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
}

function berlinHour(day: number, hour: number): string {
  const wallTime = day + hour * 3_600_000;
  const guess = wallTime - offsetMinutes(wallTime) * 60_000;
  return new Date(wallTime - offsetMinutes(guess) * 60_000).toISOString();
}

/** UTC ISO for a Berlin wall-clock time `hour:00` on the Berlin calendar day `dayOffset` days after `from`. */
export function berlinTime(from: number, dayOffset: number, hour: number): string {
  return berlinHour(berlinCivilDay(from) + dayOffset * DAY_MS, hour);
}

/**
 * Working-day slots (09:00, 11:00, 14:00 Berlin time) starting `firstDay` days from `from`.
 * Weekends are skipped. Used to seed partner calendars relative to "now" so the demo never goes stale.
 */
export function workdaySlots(from: number, firstDay: number, days: number, hours = [9, 11, 14]): string[] {
  const slots: string[] = [];
  const today = berlinCivilDay(from);
  for (let offset = firstDay; slots.length < days * hours.length && offset < firstDay + days * 3; offset++) {
    const day = today + offset * DAY_MS;
    const weekday = new Date(day).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const hour of hours) slots.push(berlinHour(day, hour));
  }
  return slots;
}
