import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

DATA_DIR = PROJECT_ROOT / "data"
SCHEMA_FILE = PROJECT_ROOT / "schema.cypher"
FRONTEND_DIR = PROJECT_ROOT / "frontend" / "dist"  # собирается: cd frontend && npm run build

# Neo4j
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7688")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "neo4jpass")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")


# Основная LLM
MODEL = os.getenv("MODEL_NAME", "qwen/qwen3.6-35b-a3b")
MODEL_API_KEY = os.getenv("MODEL_API_KEY")
MODEL_BASE_URL = os.getenv("MODEL_BASE_URL", "https://ai.api.cloud.yandex.net/v1")

# Запасная LLM (используется, если основная недоступна)
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL_NAME")
FALLBACK_API_KEY = os.getenv("FALLBACK_API_KEY")
FALLBACK_BASE_URL = os.getenv("FALLBACK_BASE_URL", "https://openrouter.ai/api/v1")

# Эмбеддинги: удалённая модель Yandex AI Studio, при недоступности — локальная BAAI/bge
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")  # dense, 1024 dim
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME")  # emb://<folder_id>/text-search-doc/latest
EMBEDDING_API_KEY = os.getenv("EMBEDDING_API_KEY")

# Параметры RAG
TOP_K = 10               # сколько вершин отдаём ЛЛМ на первом шаге
SOURCE_TOP_K = 5         # сколько публикаций отдаём ЛЛМ в ветке "вопрос про источники"
FULLTEXT_LIMIT = 25      # кандидатов на один поисковый термин
MAX_EXPANSIONS = 2       # сколько раз можно "идти вглубь", если ЛЛМ мало контекста
NEIGHBOR_LIMIT = 60      # максимум соседей за одно расширение

ENTITY_LABELS = {"Material", "Process", "Equipment", "Property",
                 "Experiment", "Expert", "Facility"}
RELATION_TYPES = {
    "uses_material": "USES_MATERIAL",
    "operates_at_condition": "OPERATES_AT_CONDITION",
    "produces_output": "PRODUCES_OUTPUT",
    "described_in": "DESCRIBED_IN",
    "validated_by": "VALIDATED_BY",
    "contradicts": "CONTRADICTS",
}
