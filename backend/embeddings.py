"""Эмбеддинги: Yandex AI Studio (text-search-doc/query), при недоступности —
локальная BAAI/bge-m3 (dense, 1024 измерения, нормированные).
Бэкенд выбирается один раз при первом обращении; локальная модель грузится
лениво (~2.3 ГБ при первом запуске)."""
import numpy as np
import requests
from . import config, db

_local_model = None
_backend = None  # "yandex" | "local"

YANDEX_EMBED_URL = "https://ai.api.cloud.yandex.net/foundationModels/v1/textEmbedding"


def _auth_header():
    key = config.EMBEDDING_API_KEY
    # IAM-токены начинаются с "t1.", API-ключи передаются как Api-Key
    if key.startswith("t1."):
        return {"Authorization": f"Bearer {key}"}
    return {"Authorization": f"Api-Key {key}"}


def _yandex_uri(text_type: str) -> str:
    uri = config.EMBEDDING_MODEL_NAME
    if text_type == "query":
        return uri.replace("text-search-doc", "text-search-query")
    return uri.replace("text-search-query", "text-search-doc")


def _yandex_embed(text: str, text_type: str) -> np.ndarray:
    resp = requests.post(
        YANDEX_EMBED_URL,
        json={"modelUri": _yandex_uri(text_type), "text": text},
        headers={"Content-Type": "application/json", **_auth_header()},
        timeout=30,
    )
    resp.raise_for_status()
    emb = np.array(resp.json()["embedding"], dtype=np.float32)
    return emb / np.linalg.norm(emb)


def _get_local_model():
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer
        _local_model = SentenceTransformer(config.EMBEDDING_MODEL)
    return _local_model


def _choose_backend() -> str:
    global _backend
    if _backend is not None:
        return _backend
    if (config.EMBEDDING_API_KEY and config.EMBEDDING_MODEL_NAME
            and config.EMBEDDING_MODEL_NAME.startswith("emb://")):
        try:
            _yandex_embed("проверка доступности", "doc")
            _backend = "yandex"
            print(f"[embeddings] использую {config.EMBEDDING_MODEL_NAME}")
            return _backend
        except Exception as e:
            print(f"[embeddings] Yandex недоступен ({type(e).__name__}: {e}), "
                  f"использую локальную {config.EMBEDDING_MODEL}")
    _backend = "local"
    return _backend


def encode(texts, text_type: str = "doc"):
    global _backend
    texts = list(texts)
    if _choose_backend() == "yandex":
        try:
            return np.array([_yandex_embed(t, text_type) for t in texts])
        except Exception as e:
            print(f"[embeddings] ошибка Yandex ({type(e).__name__}: {e}), "
                  f"переключаюсь на локальную {config.EMBEDDING_MODEL}")
            _backend = "local"
    return _get_local_model().encode(texts, normalize_embeddings=True)


def rank(query_embedding, nodes):
    if not nodes:
        return []
    dim = len(query_embedding)
    # пересчитываем и отсутствующие, и посчитанные другим бэкендом (другая размерность)
    missing = [n for n in nodes if not n.get("embedding") or len(n["embedding"]) != dim]
    if missing:
        embs = encode([n.get("text") or n["name"] for n in missing])
        for node, emb in zip(missing, embs):
            node["embedding"] = emb.tolist()
        # сохраняем пересчитанные эмбеддинги в БД, чтобы не считать их заново
        updates = [{"id": n["id"], "embedding": n["embedding"]}
                   for n in missing if n.get("id")]
        if updates:
            db.run(
                "UNWIND $rows AS row "
                "MATCH (n) WHERE elementId(n) = row.id "
                "SET n.embedding = row.embedding",
                rows=updates,
            )
    matrix = np.array([n["embedding"] for n in nodes])
    scores = matrix @ query_embedding
    for node, score in zip(nodes, scores):
        node["score"] = float(score)
    return sorted(nodes, key=lambda n: n["score"], reverse=True)
