import type { DatasetResponse } from "../types";

export async function fetchDataset(): Promise<DatasetResponse> {
  let response: Response;
  try {
    response = await fetch("/api/dataset");
  } catch {
    throw new Error("Не удалось подключиться к backend. Проверьте, что сервер запущен.");
  }

  if (!response.ok) {
    throw new Error(`Backend вернул ошибку ${response.status}`);
  }

  return (await response.json()) as DatasetResponse;
}
