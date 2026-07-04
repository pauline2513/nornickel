import type { ChatResponse } from "../types";
import { MOCK_RESPONSES } from "./mockData";

const MOCK_LATENCY_MS: [number, number] = [900, 1900];

function delay([min, max]: [number, number]) {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function guessEntities(query: string): string[] {
  const stopWords = new Set(["какой", "какая", "какие", "как", "для", "при", "что", "или", "это"]);
  const words = query
    .toLowerCase()
    .replace(/[^а-яёa-z0-9\s-]/gi, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
  return Array.from(new Set(words)).slice(0, 4);
}

let cursor = 0;

export async function askChat(query: string): Promise<ChatResponse> {
  await delay(MOCK_LATENCY_MS);

  if (!query.trim()) {
    throw new Error("Пустой запрос");
  }

  const template = MOCK_RESPONSES[cursor % MOCK_RESPONSES.length];
  cursor += 1;

  return {
    ...template,
    entities: guessEntities(query),
  };
}
