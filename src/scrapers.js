import { dateKeyInMoscow, inRange, parseRussianDate } from "./dates.js";

const URLS = {
  qtickets: "https://mariupol.qtickets.events",
  quicktickets: "https://quicktickets.ru/mariupol-dramaticheskiy-teatr",
  savona: "https://kinoteatr-savona.ru"
};

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

function titleEmoji(title, type = "") {
  const value = `${title} ${type}`.toLowerCase();
  if (/дет|сказ|мульт|реб[её]н/.test(value)) return "👶";
  if (/стендап|stand.?up/.test(value)) return "🎤";
  if (/концерт|музык|оркестр|симфон/.test(value)) return "🎼";
  if (/спектак|театр|водевил|комеди|драм/.test(value)) return "🎭";
  return "✨";
}

async function goto(page, url, timeout) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout });
}

export async function scrapeQtickets(context, range, timeout) {
  const page = await context.newPage();
  try {
    await goto(page, URLS.qtickets, timeout);
    await page.waitForSelector("time[datetime]", { timeout: Math.min(timeout, 15000) }).catch(() => {});
    const cards = await page.locator('a[href^="https://mariupol.qtickets.events/"]').evaluateAll((anchors) =>
      anchors
        .filter((a) => /^https:\/\/mariupol\.qtickets\.events\/\d+/.test(a.href) && a.querySelector("time[datetime]"))
        .map((a) => ({
          url: a.href,
          title: a.querySelector("h2")?.textContent || "",
          type: a.querySelector(".type")?.textContent || "",
          datetime: a.querySelector("time")?.getAttribute("datetime") || "",
          place: a.querySelector(".place-name")?.textContent || "",
          price: a.querySelector(".price")?.textContent || ""
        }))
    );

    return cards.map((card) => {
      const date = dateKeyInMoscow(card.datetime);
      const time = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }).format(new Date(card.datetime));
      const age = clean(card.place).match(/\b\d{1,2}\+/)?.[0] || clean(card.title).match(/\b\d{1,2}\+/)?.[0] || "";
      return {
        source: "qtickets",
        type: clean(card.type),
        title: clean(card.title).replace(/\s+\d{1,2}\+$/, ""),
        age,
        date,
        time,
        venue: clean(card.place).replace(/\s*\|\s*Данный билет.*$/i, ""),
        address: "",
        price: clean(card.price).replace("руб.", "₽"),
        description: "",
        url: card.url,
        emoji: titleEmoji(card.title, card.type)
      };
    }).filter((event) => inRange(event.date, range));
  } finally {
    await page.close();
  }
}

export async function scrapeQuickTickets(context, range, timeout) {
  const page = await context.newPage();
  try {
    await goto(page, URLS.quicktickets, timeout);
    await page.waitForSelector('.elem[data-elem-type="event"]', { timeout: Math.min(timeout, 15000) }).catch(() => {});
    const cards = await page.locator('.elem[data-elem-type="event"]').evaluateAll((elements) =>
      elements.map((element) => ({
        title: element.querySelector("h3 .underline")?.textContent || "",
        age: element.querySelector("h3 .ageRestriction")?.textContent || "",
        description: element.querySelector(".d")?.textContent || "",
        eventUrl: element.querySelector('h3 a[href*="/e"]')?.href || "",
        sessions: [...element.querySelectorAll('.sessions a[href*="/s"]')].map((a) => ({ text: a.textContent || "", url: a.href }))
      }))
    );

    return cards.flatMap((card) => card.sessions.map((session) => {
      const parsed = parseRussianDate(clean(session.text), range);
      return {
        source: "quicktickets",
        type: "Театр",
        title: clean(card.title),
        age: clean(card.age),
        date: parsed?.date || null,
        time: parsed?.time || "",
        venue: "Мариупольский русский драматический театр",
        address: "пр-т Металлургов, 52",
        price: "билеты — на сайте/в кассе",
        description: clean(card.description),
        url: session.url || card.eventUrl,
        emoji: titleEmoji(card.title, "театр")
      };
    })).filter((event) => inRange(event.date, range));
  } finally {
    await page.close();
  }
}

export async function scrapeSavona(context, range, timeout, { previewMode = false } = {}) {
  const page = await context.newPage();
  try {
    await goto(page, URLS.savona, timeout);
    await page.waitForSelector("a.releases-item", { timeout: Math.min(timeout, 15000) });
    await page.waitForSelector("a.releases-item.releases-item_soon", {
      timeout: Math.min(timeout, 15000)
    }).catch(() => {});
    let candidates = await page.locator("a.releases-item.releases-item_soon").evaluateAll((anchors) => anchors
      .map((a) => ({
        url: a.href,
        title: a.querySelector(".releases-item-description__title, .releases-item-description__title_small")?.textContent || "",
        text: a.textContent || "",
        dateText: a.querySelector(".releases-item__date")?.textContent || "",
        badges: [...a.querySelectorAll(".releases-item__premiere")].map((x) => x.textContent || ""),
        meta: [...a.querySelectorAll(".releases-item-description__badge span")].map((x) => x.textContent || "")
      }))
      .filter((item) => item.badges.some((badge) => /премьер|закрытый показ|специальный показ/i.test(badge)))
    );
    const hasThisWeekCandidate = candidates.some((item) => {
      const parsed = parseRussianDate(item.dateText, range);
      return parsed && inRange(parsed.date, range);
    });

    if (previewMode && !hasThisWeekCandidate) {
      candidates = await page.locator("a.releases-item:not(.releases-item_soon)").evaluateAll((anchors) => anchors
        .map((a) => ({
          url: a.href,
          title: a.querySelector(".releases-item-description__title, .releases-item-description__title_small")?.textContent || "",
          text: a.textContent || "",
          dateText: new URL(a.href).searchParams.get("date") || "",
          badges: [...a.querySelectorAll(".releases-item__premiere")].map((x) => x.textContent || ""),
          meta: [...a.querySelectorAll(".releases-item-description__badge span")].map((x) => x.textContent || ""),
          previewFallback: true
        }))
        .filter((item) => item.badges.some((badge) => /премьер|закрытый показ|специальный показ/i.test(badge)))
      );
      console.log(`[savona] Тестовый режим: использую ${candidates.length} текущих карточек с бейджем «Премьера».`);
    }
    if (process.env.DEBUG_SCRAPERS === "true") console.log("[savona] candidates", candidates.map((item) => ({ title: item.title, badges: item.badges, url: item.url })));

    const events = [];
    for (const item of candidates) {
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(item.dateText)
        ? { date: item.dateText, time: "00:00" }
        : parseRussianDate(item.dateText, range);
      if (!parsed || !inRange(parsed.date, range)) continue;
      const detail = await context.newPage();
      try {
        await goto(detail, item.url, timeout);
        await detail.getByText(clean(item.title), { exact: true }).first().waitFor({ state: "visible", timeout: Math.min(timeout, 12000) }).catch(() => {});
        const info = await detail.locator("body").evaluate((body) => {
          const text = body.innerText || "";
          return {
            text,
            description: document.querySelector(".release__text")?.textContent || ""
          };
        });
        if (process.env.DEBUG_SCRAPERS === "true") console.log("[savona] detail", { title: item.title, dateText: item.dateText, parsed });

        const age = item.meta.find((value) => /^\d{1,2}\+$/.test(clean(value))) || info.text.match(/\b\d{1,2}\+/)?.[0] || "";
        const duration = info.text.match(/Хронометраж\s+(\d+)\s*мин/i)?.[1];
        const tags = item.badges.map(clean).filter(Boolean).join(" · ");
        const rawDescription = clean(info.description).replace(/^Сюжет\s*/i, "");
        events.push({
          source: "savona",
          type: tags || "Кинопремьера",
          title: clean(item.title).replace(/^Аренда:\s*/i, ""),
          age,
          date: parsed.date,
          time: "",
          venue: "Кинотеатр «Савона»",
          address: "пр-т Строителей, 134",
          price: "расписание и билеты — на сайте кинотеатра",
          description: rawDescription.length >= 60 ? rawDescription : "",
          duration: duration ? `${duration} минут` : "",
          url: item.url,
          emoji: "🍿"
        });
      } catch (error) {
        console.warn(`[savona] Не удалось прочитать ${item.url}: ${error.message}`);
      } finally {
        await detail.close();
      }
    }
    return events;
  } finally {
    await page.close();
  }
}

export async function collectEvents(browser, range, timeout = 35000, { previewMode = false } = {}) {
  const context = await browser.newContext({
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/145 Safari/537.36"
  });
  try {
    const jobs = [
      ["qtickets", scrapeQtickets(context, range, timeout)],
      ["quicktickets", scrapeQuickTickets(context, range, timeout)],
      ["savona", scrapeSavona(context, range, timeout, { previewMode })]
    ];
    const settled = await Promise.all(jobs.map(async ([source, promise]) => {
      try {
        return { source, events: await promise, error: null };
      } catch (error) {
        return { source, events: [], error: error.message };
      }
    }));
    const failures = settled.filter((item) => item.error);
    const seen = new Set();
    const events = settled.flatMap((item) => item.events)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`, "ru"))
      .filter((event) => {
        const key = `${event.source}|${event.date}|${event.time}|${event.title.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return {
      events,
      failures,
      succeededSources: settled.filter((item) => !item.error).map((item) => item.source),
      sourceCounts: Object.fromEntries(settled.map((item) => [item.source, item.events.length]))
    };
  } finally {
    await context.close();
  }
}
