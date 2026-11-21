import { expect, it } from "vitest";
import { completeBody } from "@/lib/schemas";

it.each([0.01, 15.23, 100_000])("accepts a valid invoice amount of €%s", (amount_eur) => {
  expect(completeBody.safeParse({ amount_eur }).success).toBe(true);
});

it.each([-1, 0, 0.001, 12.345, 100_000.01])("rejects an invalid invoice amount of €%s", (amount_eur) => {
  expect(completeBody.safeParse({ amount_eur }).success).toBe(false);
});
