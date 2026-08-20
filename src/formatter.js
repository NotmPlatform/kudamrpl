import { formatDay, formatRange } from "./dates.js";

export const escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function shorten(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!max || text.length <= max) return text;
  const cut = text.slice(0, max - 1).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

function lead(events) {
  const cinema = events.filter((e) => e.source === "savona").length;
  const theatre = events.filter((e) => e.source === "quicktickets").length;
  const city = events.filter((e) => e.source === "qtickets").length;
  const parts = [];
  if (cinema === 1) parts.push("новая премьера в «Савоне»");
  if (cinema > 1) parts.push("новые кинопремьеры в «Савоне»");
  if (theatre === 1) parts.push("спектакль на сцене драмтеатра");
  if (theatre > 1) parts.push("спектакли на сцене драмтеатра");
  if (city === 1) parts.push("яркое городское событие");
  if (city > 1) parts.push("концерты и городские события");
  if (!parts.length) return "Собрали актуальные события недели — выбирайте настроение и планируйте красивый выход.";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} и ${parts.at(-1)}`;
  return `На этой неделе — ${list}. Выбирайте событие по настроению и сохраняйте афишу.`;
}

function quotedTitle(event) {
  const raw = String(event.title || "").replace(/^[«\"]|[»\"]$/g, "");
  return event.source === "savona" ? `«${raw}»` : raw;
}

function linkTitle(event) {
  const label = `${quotedTitle(event)}${event.age ? ` ${event.age}` : ""}`;
  return `<a href="${escapeHtml(event.url)}"><b>${escapeHtml(label)}</b></a>`;
}

function sectionTitle(event) {
  if (event.source === "savona") {
    const special = /зв[её]здн|специальн|закрыт/i.test(event.type || "");
    return special ? "🎬 <b>Специальный показ | «Савона»</b>" : "🎬 <b>Премьера недели | «Савона»</b>";
  }
  if (event.source === "quicktickets") return "🎭 <b>Театр | Мариупольский драмтеатр</b>";
  if (/концерт|музык/i.test(event.type || "")) return "🎤 <b>Концерт недели</b>";
  return "✨ <b>Событие недели</b>";
}

function fallbackDescription(event) {
  if (event.source === "savona") return "Новая история на большом экране — для атмосферного вечера в кино.";
  if (event.source === "quicktickets") return "Живая сцена, актёрская игра и красивый повод провести вечер в театре.";
  if (/концерт|музык/i.test(event.type || "")) return "Живой звук и яркая атмосфера — для музыкального вечера в городе.";
  return "Хороший повод выбраться из дома, встретиться с близкими и наполнить неделю новыми впечатлениями.";
}

function phone(event) {
  if (event.source === "savona") return "+7-949-499-97-48";
  if (event.source === "quicktickets") return "+7-949-629-91-79";
  return "";
}

function ticketLine(event) {
  const label = event.source === "savona" ? "Расписание сеансов и билеты" : "Купить билет";
  return `🎟 <a href="${escapeHtml(event.url)}">${label}</a>`;
}

function eventBlock(event, descriptionLimit, richMeta) {
  const lines = [
    `<b>${escapeHtml(formatDay(event.date))}</b>`,
    sectionTitle(event),
    `${event.emoji} ${linkTitle(event)}`
  ];

  if (descriptionLimit > 0) {
    lines.push(escapeHtml(shorten(event.description || fallbackDescription(event), descriptionLimit)));
  }

  if (event.time) lines.push(`🕒 Начало — ${escapeHtml(event.time)}`);
  const place = [event.venue, event.address].filter(Boolean).join(", ");
  if (place) lines.push(`📍 ${escapeHtml(place)}`);
  if (richMeta && event.duration) lines.push(`⏱ Продолжительность — ${escapeHtml(event.duration)}`);
  if (richMeta && event.price && event.source !== "savona") lines.push(`💳 ${escapeHtml(event.price)}`);
  lines.push(ticketLine(event));
  const contact = phone(event);
  if (richMeta && contact) lines.push(`📞 ${contact}`);
  return lines.join("\n");
}

function visibleLength(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"').length;
}

function build(events, range, descriptionLimit, richMeta = true) {
  const header = `<b>Куда сходить в Мариуполе · ${escapeHtml(formatRange(range))} | Афиша</b>`;
  const footer = `Больше событий: <a href="https://t.me/gomrpl">@gomrpl</a>`;
  const blocks = events.map((event) => eventBlock(event, descriptionLimit, richMeta));
  return [header, lead(events), ...blocks, footer].join("\n\n");
}

export function formatTelegramPost(events, range, captionLimit = 1000) {
  const startingLimit = events.length === 1 ? 380 : events.length === 2 ? 190 : 105;
  const variants = [
    { descriptionLimit: startingLimit, richMeta: true, mode: "editorial" },
    { descriptionLimit: Math.min(90, startingLimit), richMeta: true, mode: "editorial-short" },
    { descriptionLimit: 0, richMeta: true, mode: "compact" },
    { descriptionLimit: 0, richMeta: false, mode: "compact-short" }
  ];

  for (const variant of variants) {
    const caption = build(events, range, variant.descriptionLimit, variant.richMeta);
    if (visibleLength(caption) <= captionLimit) return { caption, continuation: "", mode: variant.mode };
  }

  const caption = [
    `<b>Куда сходить в Мариуполе · ${escapeHtml(formatRange(range))} | Афиша</b>`,
    lead(events),
    "Подробная подборка событий — в сообщении следом 👇"
  ].join("\n\n");
  const continuation = build(events, range, 170, true);
  return { caption, continuation, mode: "continued-editorial" };
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
