import test from "node:test";
import assert from "node:assert/strict";
import { formatRange, getWeekRange, parseRussianDate } from "../src/dates.js";

test("week in Moscow runs Monday through Sunday", () => {
  const range = getWeekRange(new Date("2026-08-20T10:00:00Z"));
  assert.deepEqual(range, { start: "2026-08-17", end: "2026-08-23", today: "2026-08-20" });
  assert.equal(formatRange(range), "17–23 августа");
});

test("Russian event date is parsed inside current week", () => {
  const range = { start: "2026-08-17", end: "2026-08-23" };
  assert.deepEqual(parseRussianDate("22 августа 20:00", range), { date: "2026-08-22", time: "20:00" });
});

test("new-year week infers next year for January", () => {
  const range = { start: "2026-12-28", end: "2027-01-03" };
  assert.deepEqual(parseRussianDate("2 января 17:00", range), { date: "2027-01-02", time: "17:00" });
});
