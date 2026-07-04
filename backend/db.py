"""Подключение к Neo4j и все запросы чтения, которые нужны RAG-пайплайну."""

from neo4j import GraphDatabase

from . import config

_driver = None


def get_driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            config.NEO4J_URI, auth=(config.NEO4J_USER, config.NEO4J_PASSWORD)
        )
    return _driver


def run(query: str, **params) -> list[dict]:
    with get_driver().session(database=config.NEO4J_DATABASE) as session:
        return [r.data() for r in session.run(query, **params)]


def apply_schema():
    """Применяет constraints/индексы из schema.cypher (идемпотентно).
    Сначала вырезает //-комментарии, потом режет на statements по ';'."""
    no_comments = "\n".join(
        line.split("//", 1)[0]
        for line in config.SCHEMA_FILE.read_text(encoding="utf-8").splitlines()
    )
    for stmt in no_comments.split(";"):
        if stmt.strip():
            run(stmt.strip())


# --------------------------------------------------------------------------
# Чтение для RAG
# --------------------------------------------------------------------------

_NODE_RETURN = """
RETURN elementId(node)  AS id,
       labels(node)[0]  AS label,
       node.name        AS name,
       node.text        AS text,
       node.embedding   AS embedding
"""


def fulltext_search(term: str, limit: int | None = None) -> list[dict]:
    """Fuzzy-поиск вершин по имени через полнотекстовый индекс entity_names."""
    words = [w for w in term.split() if w]
    if not words:
        return []
    fuzzy = " ".join(f"{w}~" for w in words)
    return run(
        "CALL db.index.fulltext.queryNodes('entity_names', $q, {limit: $limit}) "
        "YIELD node, score " + _NODE_RETURN + ", score AS ft_score",
        q=fuzzy,
        limit=limit or config.FULLTEXT_LIMIT,
    )


def fetch_neighbors(node_ids: list[str], limit: int | None = None) -> list[dict]:
    """Соседние вершины-сущности (шаг вглубь графа). Публикации не берём —
    они попадают в ответ отдельно, как источники."""
    return run(
        "MATCH (n) WHERE elementId(n) IN $ids "
        "MATCH (n)-[r]-(node) "
        "WHERE NOT node:Publication AND NOT node:Chunk "
        "WITH DISTINCT node LIMIT $limit " + _NODE_RETURN,
        ids=node_ids,
        limit=limit or config.NEIGHBOR_LIMIT,
    )


def fetch_triples(node_ids: list[str]) -> list[dict]:
    """Связи между выбранными вершинами — контекст структуры графа для ЛЛМ."""
    return run(
        "MATCH (a)-[r]->(b) "
        "WHERE elementId(a) IN $ids AND elementId(b) IN $ids "
        "RETURN DISTINCT coalesce(a.name, a.title) AS source, type(r) AS rel, "
        "       coalesce(b.name, b.title) AS target",
        ids=node_ids,
    )


def fetch_sources(node_ids: list[str]) -> list[dict]:
    """Публикации-источники использованных вершин (через DESCRIBED_IN)."""
    return run(
        "MATCH (n) WHERE elementId(n) IN $ids "
        "MATCH (n)-[:DESCRIBED_IN]->(p:Publication) "
        "RETURN DISTINCT p.uid AS uid, p.title AS title, p.year AS year, "
        "       p.source_type AS source_type, p.country AS country, "
        "       p.summary AS summary, "
        "       count { (m)-[:DESCRIBED_IN]->(p) WHERE elementId(m) IN $ids } AS used_nodes_count "
        "ORDER BY used_nodes_count DESC",
        ids=node_ids,
    )
