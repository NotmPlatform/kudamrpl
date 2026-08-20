import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { loadConfig, validateConfig } from "./config.js";
import { createCover } from "./cover.js";
import { getWeekRange, isMondayMoscow } from "./dates.js";
import { formatPlainText, formatTelegramPost } from "./formatter.js";
import { collectEvents } from "./scrapers.js";
import { fingerprint, readState, writeState } from "./state.js";
import { notify, sendMessage, sendPhoto } from "./telegram.js";

async function main() {
  const config = loadConfig();
  validateConfig(config);

  if (!config.allowAnyDay && !isMondayMoscow()) {
    console.log("Сегодня не понедельник по Москве. Для ручной проверки задайте ALLOW_ANY_DAY=true и DRY_RUN=true.");
    return;
  }

  const range = getWeekRange();
  console.log(`Собираю события за ${range.start}—${range.end}`);
  const browser = await chromium.launch({
    headless: true,
    executablePath: config.browserExecutablePath || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  let result;
  try {
    result = await collectEvents(browser, range, config.timeout);
  } finally {
    await browser.close();
  }

  if (result.failures.length) {
    console.warn("Ошибки источников:", result.failures);
  }
  console.log("Событий по источникам:", result.sourceCounts);
  if (!result.succeededSources.length) throw new Error("Все три источника недоступны — публикация отменена");
  if (!result.events.length) {
    await notify(config, "⚠️ GoMRPL: на текущей неделе события не найдены. Автопубликация пропущена; проверьте сайты и логи Railway.");
    console.log("События не найдены. Публикация пропущена.");
    return;
  }

  const hash = fingerprint(range.start, result.events);
  const state = await readState(config.stateFile);
  if (!config.forcePublish && state.weekStart === range.start && state.fingerprint === hash) {
    console.log("Эта подборка уже была опубликована. Повтор пропущен.");
    return;
  }

  const { caption, continuation, mode } = formatTelegramPost(result.events, range, config.captionLimit);
  const coverPath = path.join(config.outDir, `gomrpl-${range.start}.jpg`);
  await createCover(result.events, range, coverPath);
  await fs.mkdir(config.outDir, { recursive: true });
  await fs.writeFile(path.join(config.outDir, `gomrpl-${range.start}.html.txt`), `${caption}${continuation ? `\n\n--- ПРОДОЛЖЕНИЕ ---\n\n${continuation}` : ""}\n`, "utf8");
  await fs.writeFile(path.join(config.outDir, `gomrpl-${range.start}.txt`), `${formatPlainText(caption)}${continuation ? `\n\n${formatPlainText(continuation)}` : ""}\n`, "utf8");
  await fs.writeFile(path.join(config.outDir, `events-${range.start}.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(`Найдено событий: ${result.events.length}; режим текста: ${mode}; обложка: ${coverPath}`);
  if (config.dryRun) {
    console.log("DRY_RUN=true — Telegram не затронут.");
    console.log(formatPlainText(caption));
    return;
  }

  const target = config.publishTarget === "review" ? config.reviewChatId : config.channelId;
  const photoMessage = await sendPhoto({ token: config.botToken, chatId: target, photoPath: coverPath, caption });
  if (continuation) await sendMessage({ token: config.botToken, chatId: target, text: continuation, disablePreview: true });

  await writeState(config.stateFile, {
    weekStart: range.start,
    fingerprint: hash,
    publishedAt: new Date().toISOString(),
    target,
    messageId: photoMessage.message_id,
    eventCount: result.events.length
  });
  console.log(`Опубликовано в ${target}, message_id=${photoMessage.message_id}`);
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  const config = loadConfig();
  await notify(config, `❌ GoMRPL: недельная публикация не выполнена.\n\n${String(error.message).slice(0, 1200)}`);
  process.exitCode = 1;
});
