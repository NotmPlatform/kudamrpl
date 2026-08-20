const MOSCOW_TZ = "Europe/Moscow";

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

const MONTH_MAP = new Map(MONTHS.map((name, index) => [name, index + 1]));
const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

function zonedParts(date, timeZone = MOSCOW_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
}

export function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function getWeekRange(now = new Date()) {
  const { year, month, day } = zonedParts(now);
  const today = isoDate(year, month, day);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addDays(today, -((weekday + 6) % 7));
  return { start: monday, end: addDays(monday, 6), today };
}

export function dateKeyInMoscow(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  const { year, month, day } = zonedParts(date);
  return isoDate(year, month, day);
}

export function inRange(dateKey, range) {
  return Boolean(dateKey && dateKey >= range.start && dateKey <= range.end);
}

export function parseRussianDate(text, range, fallbackTime = "00:00") {
  const match = String(text).toLowerCase().match(/(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?(?:[^\d]+(\d{1,2}):(\d{2}))?/i);
  if (!match || !MONTH_MAP.has(match[2])) return null;

  const day = Number(match[1]);
  const month = MONTH_MAP.get(match[2]);
  const startYear = Number(range.start.slice(0, 4));
  let year = match[3] ? Number(match[3]) : startYear;
  const startMonth = Number(range.start.slice(5, 7));
  if (!match[3] && startMonth === 12 && month === 1) year += 1;
  if (!match[3] && startMonth === 1 && month === 12) year -= 1;

  const time = match[4] ? `${String(match[4]).padStart(2, "0")}:${match[5]}` : fallbackTime;
  return { date: isoDate(year, month, day), time };
}

export function formatDay(dateKey, capitalize = true) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const value = `${weekday} · ${day} ${MONTHS[month - 1]}`;
  return capitalize ? value[0].toUpperCase() + value.slice(1) : value;
}

export function formatRange(range) {
  const [sy, sm, sd] = range.start.split("-").map(Number);
  const [ey, em, ed] = range.end.split("-").map(Number);
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[sm - 1]}`;
  if (sy === ey) return `${sd} ${MONTHS[sm - 1]} — ${ed} ${MONTHS[em - 1]}`;
  return `${sd} ${MONTHS[sm - 1]} ${sy} — ${ed} ${MONTHS[em - 1]} ${ey}`;
}

export function isMondayMoscow(now = new Date()) {
  const { today } = getWeekRange(now);
  return new Date(`${today}T00:00:00Z`).getUTCDay() === 1;
}
