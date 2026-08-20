import { formatDay, formatRange } from "./dates.js";

export const escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function shorten(value, max) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

function lead(events) {
  const parts = [];
  if (events.some((e) => e.source === "savona")) parts.push("кинопремьеры в «Савоне»");
  if (events.some((e) => e.source === "quicktickets")) parts.push("спектакли драмтеатра");
  if (events.some((e) => e.source === "qtickets")) parts.push("концерты и городские события");
  if (!parts.length) return "Собрали актуальные события недели.";
  if (parts.length === 1) return `На этой неделе — ${parts[0]}.`;
  return `На этой неделе — ${parts.slice(0, -1).join(", ")} и ${parts.at(-1)}.`;
}

function linkTitle(event) {
  const label = `${event.title}${event.age ? ` ${event.age}` : ""}`;
  return `<a href="${escapeHtml(event.url)}">${escapeHtml(label)}</a>`;
}

function groupedBlocks(events, detailed) {
  const groups = new Map();
  for (const event of events) {
    if (!groups.has(event.date)) groups.set(event.date, []);
    groups.get(event.date).push(event);
  }
  const blocks = [];
  for (const [date, items] of groups) {
    const lines = [`<b>${escapeHtml(formatDay(date))}</b>`];
    for (const event of items) {
      lines.push(`${event.emoji} ${linkTitle(event)}${event.time ? ` · ${escapeHtml(event.time)}` : ""}`);
      if (detailed && event.description) lines.push(escapeHtml(shorten(event.description, 150)));
      if (detailed) {
        const place = [event.venue, event.address].filter(Boolean).join(", ");
        if (place) lines.push(`📍 ${escapeHtml(place)}`);
        if (event.price) lines.push(`💳 ${escapeHtml(event.price)}`);
      }
    }
    blocks.push(lines.join("\n"));
  }
  return blocks;
}

function visibleLength(html) {
  return html.replace(/<[^>]*>/g, "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').length;
}

function build(events, range, detailed) {
  const header = `<b>Куда сходить в Мариуполе · ${escapeHtml(formatRange(range))} | Афиша</b>`;
  const footer = `Больше событий: <a href="https://t.me/gomrpl">@gomrpl</a>`;
  return [header, lead(events), ...groupedBlocks(events, detailed), footer].join("\n\n");
}

export function formatTelegramPost(events, range, captionLimit = 1000) {
  const detailed = build(events, range, true);
  if (visibleLength(detailed) <= captionLimit) return { caption: detailed, continuation: "", mode: "detailed" };

  const compact = build(events, range, false);
  if (visibleLength(compact) <= captionLimit) return { caption: compact, continuation: "", mode: "compact" };

  const caption = [
    `<b>Куда сходить в Мариуполе · ${escapeHtml(formatRange(range))} | Афиша</b>`,
    lead(events),
    "Полная подборка событий — в сообщении следом 👇"
  ].join("\n\n");
  return { caption, continuation: compact, mode: "continued" };
}

export function formatPlainText(html) {
  return html
    .replace(/<a [^>]*>(.*?)<\/a>/g, "$1")
    .replace(/<\/?b>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"');
}
