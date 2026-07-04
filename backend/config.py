import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
SCHEMA_FILE = PROJECT_ROOT / "schema.cypher"
FRONTEND_DIR = PROJECT_ROOT / "frontend" / "dist"  # собирается: cd frontend && npm run build

# Neo4j
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7688")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "neo4jpass")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

# LLM (Claude API, ключ — в переменной окружения ANTHROPIC_API_KEY)
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-8")

# Эмбеддинги
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")  # dense, 1024 dim

# Параметры RAG
TOP_K = 10               # сколько вершин отдаём ЛЛМ на первом шаге
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
