import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

const xml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function formatPosterRange(range) {
  const [startYear, startMonth, startDay] = range.start.split("-").map(Number);
  const [endYear, endMonth, endDay] = range.end.split("-").map(Number);
  const start = `${startDay} ${MONTHS[startMonth - 1]}`;
  const end = `${endDay} ${MONTHS[endMonth - 1]}`;
  if (startYear === endYear) return `${start} — ${end}`;
  return `${start} ${startYear} — ${end} ${endYear}`;
}

function dateOverlay(range) {
  const label = formatPosterRange(range);
  const fontSize = Math.max(43, Math.min(60, Math.floor(1650 / label.length)));
  return Buffer.from(`
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="dateShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000" flood-opacity=".9"/>
          <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#ff6a00" flood-opacity=".28"/>
        </filter>
      </defs>
      <text x="540" y="710" text-anchor="middle"
        font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}"
        font-weight="800" letter-spacing="-1" fill="#ff5a0a"
        stroke="#2a0c00" stroke-width="1.2" paint-order="stroke" filter="url(#dateShadow)">${xml(label)}</text>
    </svg>`);
}

export async function createCover(_events, range, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const templatePath = path.resolve("assets/poster-template.png");
  const exists = await fs.access(templatePath).then(() => true).catch(() => false);
  if (!exists) {
    throw new Error("Не найден фирменный шаблон assets/poster-template.png. Загрузите этот файл в GitHub вместе с обновлением.");
  }

  await sharp(templatePath)
    .resize(1080, 1080, { fit: "cover" })
    .composite([{ input: dateOverlay(range) }])
    .jpeg({ quality: 93, chromaSubsampling: "4:4:4" })
    .toFile(outputPath);
  return outputPath;
}
