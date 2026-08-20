import test from "node:test";
import assert from "node:assert/strict";
import { formatPlainText, formatTelegramPost } from "../src/formatter.js";

test("formatter preserves spacing and stays in a Telegram photo caption", () => {
  const events = [{
    source: "savona", title: "Мотор Сити", age: "18+", date: "2026-08-20", time: "", venue: "Кинотеатр «Савона»",
    address: "пр-т Строителей, 134", price: "билеты — на сайте", description: "Криминальный экшен о мести.",
    url: "https://kinoteatr-savona.ru/release/25801?date=2026-08-20", emoji: "🍿"
  }];
  const result = formatTelegramPost(events, { start: "2026-08-17", end: "2026-08-23" }, 1000);
  assert.equal(result.continuation, "");
  assert.match(formatPlainText(result.caption), /Четверг · 20 августа\n🎬 Премьера недели \| «Савона»\n🍿 «Мотор Сити» 18\+/);
  assert.match(formatPlainText(result.caption), /📞 \+7-949-499-97-48/);
  assert.ok(formatPlainText(result.caption).length <= 1000);
});
