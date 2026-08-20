import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export function fingerprint(weekStart, events) {
  const payload = JSON.stringify({ weekStart, events: events.map((event) => [event.source, event.date, event.time, event.title, event.url]) });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export async function readState(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

export async function writeState(file, state) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fs.rename(temporary, file);
}
