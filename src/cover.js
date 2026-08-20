import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { formatRange } from "./dates.js";

const xml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function fit(value, max = 34) {
  const text = String(value || "").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function eventLines(events) {
  return events.slice(0, 6).map((event, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 95 + column * 485;
    const y = 550 + row * 128;
    const day = `${event.date.slice(8, 10)}.${event.date.slice(5, 7)}${event.time ? ` · ${event.time}` : ""}`;
    return `
      <g transform="translate(${x} ${y})">
        <text class="eventDay" x="0" y="0">${xml(event.emoji)} ${xml(day)}</text>
        <text class="eventTitle" x="0" y="42">${xml(fit(event.title))}</text>
        <text class="eventMeta" x="0" y="78">${xml(fit(event.venue, 40))}</text>
      </g>`;
  }).join("");
}

function svg(events, range, { transparentBackground = false, omitDefaultLogo = false } = {}) {
  return `
  <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#030714"/>
        <stop offset="0.58" stop-color="#071225"/>
        <stop offset="1" stop-color="#17100b"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#f47a20" stop-opacity=".62"/>
        <stop offset="1" stop-color="#f47a20" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="6" stdDeviation="9" flood-opacity=".8"/></filter>
    </defs>
    <rect width="1080" height="1080" fill="${transparentBackground ? "#02050c" : "url(#bg)"}" fill-opacity="${transparentBackground ? ".60" : "1"}"/>
    <circle cx="710" cy="720" r="430" fill="url(#glow)" opacity=".34"/>
    <g opacity=".23" fill="#f47a20">
      <path d="M0 980V850l70-36 30 45 55-100 58 120 42-170 42 145 52-95 40 117 62-204 55 189 47-133 65 175 55-78 45 72 65-190 67 156 70-120 45 157 58-74 54 94v140z"/>
      <rect x="70" y="790" width="8" height="150"/><rect x="165" y="735" width="7" height="205"/><rect x="482" y="685" width="8" height="255"/><rect x="865" y="712" width="8" height="228"/>
    </g>
    ${omitDefaultLogo ? "" : `<g filter="url(#shadow)">
      <circle cx="540" cy="115" r="70" fill="#07101d" stroke="#f47a20" stroke-width="4"/>
      <text x="540" y="108" text-anchor="middle" class="logoSmall">GO</text>
      <text x="540" y="140" text-anchor="middle" class="logoBig">Марик</text>
    </g>`}
    <text x="540" y="285" text-anchor="middle" class="title">Куда сходить</text>
    <text x="540" y="365" text-anchor="middle" class="title">в Мариуполе</text>
    <line x1="330" y1="405" x2="750" y2="405" stroke="#f47a20" stroke-width="4"/>
    <text x="540" y="470" text-anchor="middle" class="range">${xml(formatRange(range))}</text>
    ${eventLines(events)}
    <rect x="0" y="1012" width="1080" height="68" fill="#02050c" fill-opacity=".82"/>
    <text x="540" y="1055" text-anchor="middle" class="footer">Больше событий: @gomrpl</text>
    <style>
      text { font-family: "DejaVu Sans", Arial, sans-serif; fill: #fff; }
      .logoSmall { font-weight: 800; font-size: 30px; fill: #f47a20; }
      .logoBig { font-weight: 700; font-size: 25px; }
      .title { font-weight: 800; font-size: 72px; letter-spacing: -2px; }
      .range { font-weight: 800; font-size: 43px; fill: #f47a20; }
      .eventDay { font-weight: 700; font-size: 24px; fill: #f47a20; }
      .eventTitle { font-weight: 750; font-size: 27px; }
      .eventMeta { font-size: 19px; fill: #d5d8df; }
      .footer { font-size: 22px; fill: #e7e8eb; }
    </style>
  </svg>`;
}

export async function createCover(events, range, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const backgroundPath = path.resolve("assets/background.jpg");
  const logoPath = path.resolve("assets/logo.png");
  const hasBackground = await fs.access(backgroundPath).then(() => true).catch(() => false);
  const hasLogo = await fs.access(logoPath).then(() => true).catch(() => false);
  const overlay = Buffer.from(svg(events, range, { transparentBackground: hasBackground, omitDefaultLogo: hasLogo }));

  const image = hasBackground
    ? sharp(backgroundPath).resize(1080, 1080, { fit: "cover" }).composite([{ input: overlay }])
    : sharp(overlay);

  if (hasLogo) {
    const logo = await sharp(logoPath).resize(145, 145, { fit: "contain" }).png().toBuffer();
    image.composite([{ input: logo, left: 468, top: 42 }]);
  }

  await image.jpeg({ quality: 91, chromaSubsampling: "4:4:4" }).toFile(outputPath);
  return outputPath;
}
