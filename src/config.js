import process from "node:process";
import path from "node:path";

try {
  process.loadEnvFile?.();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const bool = (name, fallback = false) => {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

export function loadConfig(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run") || bool("DRY_RUN", true);
  return {
    botToken: process.env.BOT_TOKEN || "",
    channelId: process.env.TELEGRAM_CHAT_ID || "@gomrpl",
    reviewChatId: process.env.REVIEW_CHAT_ID || "",
    publishTarget: process.env.PUBLISH_TARGET || "channel",
    dryRun,
    allowAnyDay: bool("ALLOW_ANY_DAY", false),
    forcePublish: bool("FORCE_PUBLISH", false),
    captionLimit: Math.min(1024, Number(process.env.CAPTION_LIMIT || 1000)),
    timeout: Number(process.env.PAGE_TIMEOUT_MS || 35000),
    browserExecutablePath: process.env.BROWSER_EXECUTABLE_PATH || "",
    stateFile: process.env.STATE_FILE || path.resolve("state/gomrpl-state.json"),
    outDir: path.resolve("out")
  };
}

export function validateConfig(config) {
  const errors = [];
  if (!config.dryRun && !config.botToken) errors.push("BOT_TOKEN не задан");
  if (!config.dryRun && config.publishTarget === "review" && !config.reviewChatId) errors.push("Для PUBLISH_TARGET=review нужен REVIEW_CHAT_ID");
  if (!config.channelId) errors.push("TELEGRAM_CHAT_ID не задан");
  if (errors.length) throw new Error(errors.join("; "));
}
