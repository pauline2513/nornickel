import type { GraphResponse } from "../types";

export async function fetchGraph(searchQuery = ""): Promise<GraphResponse> {
  const params = new URLSearchParams({
    limit: "350",
  });

  const search = searchQuery.trim();
  if (search) {
    params.set("search", search);
  }

  let response: Response;
  try {
    response = await fetch(`/api/graph?${params.toString()}`);
  } catch {
    throw new Error("Не удалось подключиться к backend. Проверьте, что сервер запущен.");
  }

  if (!response.ok) {
    throw new Error(`Backend вернул ошибку ${response.status}`);
  }

  return (await response.json()) as GraphResponse;
}
