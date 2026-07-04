"""Эмбеддинги BAAI/bge-m3 (dense, 1024 измерения, нормированные).
Модель грузится лениво при первом обращении (~2.3 ГБ при первом запуске)."""
from sentence_transformers import SentenceTransformer
import numpy as np
from . import config

model = None


def get_model():
    global model
    if model is None:
        model = SentenceTransformer(config.EMBEDDING_MODEL)
    return model


def encode(texts):
    return get_model().encode(list(texts), normalize_embeddings=True)


def rank(query_embedding, nodes):
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
