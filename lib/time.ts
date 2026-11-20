const DAY_MS = 24 * 60 * 60 * 1000;

export const nowIso = () => new Date().toISOString();
export const addDays = (iso: string | number, days: number) =>
  new Date((typeof iso === "string" ? Date.parse(iso) : iso) + days * DAY_MS).toISOString();
export const addMinutes = (iso: string, minutes: number) =>
  new Date(Date.parse(iso) + minutes * 60_000).toISOString();
export const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

const berlinParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
});
const berlinOffset = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" });

/** UTC ISO for a Berlin wall-clock time `hour:00` on the Berlin calendar day `dayOffset` days after `from`. */
export function berlinTime(from: number, dayOffset: number, hour: number): string {
  const parts = berlinParts.formatToParts(from);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const guess = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + dayOffset, hour));
  const offset = berlinOffset.formatToParts(guess).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
  const minutes = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
  return new Date(guess.getTime() - minutes * 60_000).toISOString();
}

/**
 * Working-day slots (09:00, 11:00, 14:00 Berlin time) starting `firstDay` days from `from`.
 * Weekends are skipped. Used to seed partner calendars relative to "now" so the demo never goes stale.
 */
export function workdaySlots(from: number, firstDay: number, days: number, hours = [9, 11, 14]): string[] {
  const slots: string[] = [];
  for (let offset = firstDay; slots.length < days * hours.length && offset < firstDay + days * 3; offset++) {
    const weekday = berlinParts.formatToParts(from + offset * DAY_MS).find((p) => p.type === "weekday")?.value;
    if (weekday === "Sat" || weekday === "Sun") continue;
    for (const hour of hours) slots.push(berlinTime(from, offset, hour));
  }
  return slots;
}
