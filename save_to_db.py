from pathlib import Path

from neo4j import GraphDatabase
import os


NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7688")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "neo4jpass")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

SCHEMA_FILE = Path(__file__).parent / "schema.cypher"


def get_driver():
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def apply_schema(driver):
    statements = [
        s.strip()
        for s in SCHEMA_FILE.read_text(encoding="utf-8").split(";")
        if s.strip() and not all(line.strip().startswith("//") for line in s.strip().splitlines())
    ]
    with driver.session(database=NEO4J_DATABASE) as session:
        for stmt in statements:
            session.run(stmt)
    print(f"Применено {len(statements)} statements из {SCHEMA_FILE.name}")


def save_publication(driver, pub: dict):
    """Создаёт/обновляет публикацию. Ключ — pub['uid'] (DOI или свой ID).

    Ожидаемые поля: uid, title, year, source_type, country, language, venue, url, doi.
    """
    query = """
    MERGE (p:Publication {uid: $uid})
    SET p += $props
    """
    props = {k: v for k, v in pub.items() if k != "uid" and v is not None}
    with driver.session(database=NEO4J_DATABASE) as session:
        session.run(query, uid=pub["uid"], props=props)


def link_described_in(driver, label: str, name_or_uid: str, pub_uid: str,
                      quote: str | None = None, page: int | None = None):
    """Привязывает сущность к публикации-источнику: (сущность)-[:DESCRIBED_IN]->(Publication).

    label — метка узла (Material, Process, ...); сущность ищется по name,
    для Property/Experiment — по uid.
    """
    key = "uid" if label in ("Property", "Experiment", "Publication", "Chunk") else "name"
    query = f"""
    MATCH (e:{label} {{{key}: $value}})
    MATCH (p:Publication {{uid: $pub_uid}})
    MERGE (e)-[r:DESCRIBED_IN]->(p)
    SET r.quote = coalesce($quote, r.quote),
        r.page  = coalesce($page,  r.page)
    """
    with driver.session(database=NEO4J_DATABASE) as session:
        session.run(query, value=name_or_uid, pub_uid=pub_uid, quote=quote, page=page)


def find_similar_entities(driver, name: str, limit: int = 5):
    """Ищет похожие по имени сущности через полнотекстовый индекс.

    Вызывать ПЕРЕД созданием нового узла: если нашлась близкая вершина —
    использовать её, а новое написание добавить в aliases.
    Fuzzy-поиск: к каждому слову добавляется ~ (расстояние Левенштейна).
    """
    fuzzy_query = " ".join(f"{w}~" for w in name.split())
    query = """
    CALL db.index.fulltext.queryNodes('entity_names', $q, {limit: $limit})
    YIELD node, score
    RETURN labels(node)[0] AS label, node.name AS name, score
    """
    with driver.session(database=NEO4J_DATABASE) as session:
        return [dict(r) for r in session.run(query, q=fuzzy_query, limit=limit)]


def merge_duplicates(driver, label: str, keep_name: str, dup_name: str):
    """Сливает два узла-дубля: все связи dup переносятся на keep,
    имя дубля сохраняется в aliases, сам дубль удаляется. Требует APOC.
    """
    query = f"""
    MATCH (keep:{label} {{name: $keep_name}})
    MATCH (dup:{label} {{name: $dup_name}})
    SET keep.aliases = coalesce(keep.aliases, []) + $dup_name
    WITH keep, dup
    CALL apoc.refactor.mergeNodes([keep, dup],
        {{properties: 'discard', mergeRels: true}})
    YIELD node
    RETURN node.name AS name
    """
    with driver.session(database=NEO4J_DATABASE) as session:
        return session.run(query, keep_name=keep_name, dup_name=dup_name).single()


if __name__ == "__main__":
    driver = get_driver()
    try:
        apply_schema(driver)
    finally:
        driver.close()
