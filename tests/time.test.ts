import { afterEach, expect, it, vi } from "vitest";
import { callVariables } from "@/lib/agent/voice";
import { builtinSeed } from "@/lib/seed";
import { workdaySlots } from "@/lib/time";

afterEach(() => vi.useRealTimers());

it("uses the Berlin civil date for voice calls just after local midnight", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-22T00:30:00+01:00"));
  const { tickets, companies, properties } = builtinSeed();
  expect(callVariables(tickets[0], companies[0], properties[0])).toMatchObject({
    current_date: "2026-11-22", time_zone: "Europe/Berlin",
  });
});

it.each([
  ["2026-03-27T23:30:00+01:00", "2026-03-30T07:00:00.000Z", "2026-03-30T09:00:00.000Z", "2026-03-30T12:00:00.000Z"],
  ["2026-10-23T23:30:00+02:00", "2026-10-26T08:00:00.000Z", "2026-10-26T10:00:00.000Z", "2026-10-26T13:00:00.000Z"],
])("offers Monday slots at Berlin business hours across the DST weekend after %s", (friday, ...mondaySlots) => {
  expect(workdaySlots(Date.parse(friday), 1, 1)).toEqual(mondaySlots);
});
