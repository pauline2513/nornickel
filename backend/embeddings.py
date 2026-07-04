"""Эмбеддинги BAAI/bge-m3 (dense, 1024 измерения, нормированные).
Модель грузится лениво при первом обращении (~2.3 ГБ при первом запуске)."""

import numpy as np

from . import config

_model = None


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(config.EMBEDDING_MODEL)
    return _model


def encode(texts: list[str]) -> np.ndarray:
    return get_model().encode(list(texts), normalize_embeddings=True)


def rank(query_embedding: np.ndarray, nodes: list[dict]) -> list[dict]:
    """Проставляет nodes[i]['score'] = косинусная близость к запросу и сортирует по убыванию.
    Вершины без сохранённого эмбеддинга дозакодируются на лету по имени."""
    if not nodes:
        return []
    missing = [n for n in nodes if not n.get("embedding")]
    if missing:
        embs = encode([n.get("text") or n["name"] for n in missing])
        for node, emb in zip(missing, embs):
            node["embedding"] = emb.tolist()
    matrix = np.array([n["embedding"] for n in nodes])
    scores = matrix @ query_embedding
    for node, score in zip(nodes, scores):
        node["score"] = float(score)
    return sorted(nodes, key=lambda n: n["score"], reverse=True)
