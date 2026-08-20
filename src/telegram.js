import fs from "node:fs/promises";

async function api(token, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body });
  const result = await response.json();
  if (!result.ok) throw new Error(`Telegram ${method}: ${result.description || response.status}`);
  return result.result;
}

export async function sendPhoto({ token, chatId, photoPath, caption }) {
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", caption);
  form.set("parse_mode", "HTML");
  form.set("photo", new Blob([await fs.readFile(photoPath)], { type: "image/jpeg" }), "afisha.jpg");
  return api(token, "sendPhoto", form);
}

export async function sendMessage({ token, chatId, text, disablePreview = true }) {
  const form = new URLSearchParams({
    chat_id: String(chatId),
    text,
    parse_mode: "HTML",
    disable_web_page_preview: String(disablePreview)
  });
  return api(token, "sendMessage", form);
}

export async function notify(config, text) {
  if (!config.botToken || !config.reviewChatId) return;
  try {
    await sendMessage({ token: config.botToken, chatId: config.reviewChatId, text, disablePreview: true });
  } catch (error) {
    console.error(`Не удалось отправить уведомление: ${error.message}`);
  }
}
