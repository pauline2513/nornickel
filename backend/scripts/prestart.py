"""Инициализация при старте контейнера (запускается перед uvicorn):
- скачивает веса локальной модели эмбеддингов, если их ещё нет в кэше (volume);
- если граф пуст — прогоняет ingest по data/*.json;
- затем enrich_sources (идемпотентен: суммаризирует только публикации без summary).
Ошибки инициализации не мешают старту API.

Запуск: python -m backend.scripts.prestart
"""

import subprocess
import sys

from .. import config, db


def download_local_embedding_model():
    """Веса BAAI/bge-m3 (~2.3 ГБ) — скачиваются один раз, живут в volume.
    onnx/openvino-копии не тянем, они не нужны и удваивают объём."""
    try:
        from huggingface_hub import snapshot_download
        print(f"[init] проверяю кэш локальной модели {config.EMBEDDING_MODEL}")
        snapshot_download(
            config.EMBEDDING_MODEL,
            ignore_patterns=["onnx/*", "openvino/*", "*.onnx", "*.onnx_data", "imgs/*"],
        )
        print("[init] локальная модель эмбеддингов на месте")
    except Exception as e:
        print(f"[init] не удалось скачать локальную модель "
              f"({type(e).__name__}: {e}) — фолбэк эмбеддингов будет недоступен")


def main():
    download_local_embedding_model()
    try:
        nodes = db.run("MATCH (n) RETURN count(n) AS c")[0]["c"]
    except Exception as e:
        print(f"[init] Neo4j недоступен ({type(e).__name__}: {e}) — пропускаю инициализацию")
        return

    if nodes == 0:
        print("[init] граф пуст — запускаю ingest")
        subprocess.run([sys.executable, "-m", "backend.scripts.ingest"])
    else:
        print(f"[init] в графе {nodes} вершин — ingest пропущен")

    print("[init] проверяю саммари источников (enrich_sources)")
    subprocess.run([sys.executable, "-m", "backend.scripts.enrich_sources"])


if __name__ == "__main__":
    main()
