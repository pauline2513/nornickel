import type { ChatResponse } from "../types";

export async function askChat(query: string): Promise<ChatResponse> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Пустой запрос");
  }

  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: trimmedQuery }),
    });
  } catch {
    throw new Error("Не удалось подключиться к backend. Проверьте, что сервер на http://localhost:8000 запущен.");
  }

  if (!response.ok) {
    let message = `Backend вернул ошибку ${response.status}`;

    try {
      const errorBody = await response.json();
      if (typeof errorBody?.detail === "string" && errorBody.detail.trim()) {
        message = errorBody.detail;
      }
    } catch {
      // If backend returned a non-JSON error, keep the status-based message.
    }

    throw new Error(message);
  }

  return (await response.json()) as ChatResponse;
}
