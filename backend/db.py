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


def run(query, **params):
    with get_driver().session(database=config.NEO4J_DATABASE) as session:
        return [r.data() for r in session.run(query, **params)]


def apply_schema():
    no_comments = "\n".join(
        line.split("//", 1)[0]
        for line in config.SCHEMA_FILE.read_text(encoding="utf-8").splitlines()
    )
    for stmt in no_comments.split(";"):
        if stmt.strip():
            run(stmt.strip())


_NODE_RETURN = """
RETURN elementId(node)  AS id,
       labels(node)[0]  AS label,
       node.name        AS name,
       node.text        AS text,
       node.start       AS start,
       node.end         AS end,
       node.embedding   AS embedding
"""

_NOT_DESCRIBED_ONLY = """
NOT (
    count { (node)--() } = 1
    AND count { (node)-[:DESCRIBED_IN]-() } = 1
)
"""

def fulltext_search(term, limit=None):
    words = [w for w in term.split() if w]
    if not words:
        return []
    fuzzy = " ".join(f"{w}~" for w in words)
    return run(
        "CALL db.index.fulltext.queryNodes('entity_names', $q, {limit: $limit}) "
        "YIELD node, score "
        f"WHERE {_NOT_DESCRIBED_ONLY} "
        + _NODE_RETURN + ", score AS ft_score",
        q=fuzzy,
        limit=limit or config.FULLTEXT_LIMIT,
    )


def fetch_neighbors(node_ids, limit=None):
    return run(
        "MATCH (n) WHERE elementId(n) IN $ids "
        "MATCH (n)-[r]-(node) "
        "WHERE NOT node:Publication AND NOT node:Chunk "
        f"AND {_NOT_DESCRIBED_ONLY} "
        "WITH DISTINCT node LIMIT $limit " + _NODE_RETURN,
        ids=node_ids,
        limit=limit or config.NEIGHBOR_LIMIT,
    )


def fetch_triples(node_ids):
    return run(
        "MATCH (a)-[r]->(b) "
        "WHERE elementId(a) IN $ids AND elementId(b) IN $ids "
        "RETURN DISTINCT coalesce(a.name, a.title) AS source, type(r) AS rel, "
        "       coalesce(b.name, b.title) AS target",
        ids=node_ids,
    )


def fetch_publications_with_summary():
    return run(
        "MATCH (p:Publication) "
        "WHERE p.summary IS NOT NULL AND p.source_file IS NOT NULL "
        "RETURN p.uid AS uid, p.title AS title, p.year AS year, "
        "       p.source_type AS source_type, p.country AS country, "
        "       p.actualization_date AS actualization_date, "
        "       p.summary AS summary, p.link AS link"
    )


def fetch_sources(node_ids):
    return run(
        "MATCH (n) WHERE elementId(n) IN $ids "
        "MATCH (n)-[:DESCRIBED_IN]->(p:Publication) "
        "WHERE p.source_file IS NOT NULL "
        "RETURN DISTINCT p.uid AS uid, p.title AS title, p.year AS year, "
        "       p.source_type AS source_type, p.country AS country, "
        "       p.actualization_date AS actualization_date, "
        "       p.summary AS summary, p.link AS link, "
        "       count { (m)-[:DESCRIBED_IN]->(p) WHERE elementId(m) IN $ids } AS used_nodes_count "
        "ORDER BY used_nodes_count DESC",
        ids=node_ids,
    )


def fetch_graph(limit=350, search=""):
    search = (search or "").strip().lower()
    result = run(
        "MATCH (seed) "
        "WHERE NOT seed:Chunk AND NOT seed:Publication "
        "  AND ("
        "    $search = '' "
        "    OR toLower(coalesce(seed.name, seed.text, seed.uid, '')) CONTAINS $search "
        "  ) "
        "MATCH (seed)-[seed_rel]-(neighbor) "
        "WHERE NOT neighbor:Chunk AND NOT neighbor:Publication "
        "WITH seed, count(DISTINCT neighbor) AS connectivity "
        "ORDER BY connectivity DESC, coalesce(seed.name, seed.text, seed.uid) ASC "
        "LIMIT $seed_limit "
        "WITH collect(seed) AS seeds "
        "MATCH (seed)-[r]-(neighbor) "
        "WHERE seed IN seeds AND NOT neighbor:Chunk AND NOT neighbor:Publication "
        "WITH collect(DISTINCT seed) + collect(DISTINCT neighbor) AS raw_nodes, "
        "     collect(DISTINCT r) AS raw_rels "
        "UNWIND raw_nodes AS node "
        "WITH collect(DISTINCT node)[0..$limit] AS nodes, raw_rels "
        "WITH nodes, [rel IN raw_rels WHERE startNode(rel) IN nodes AND endNode(rel) IN nodes] AS rels "
        "UNWIND nodes AS source_node "
        "OPTIONAL MATCH (source_node)-[:DESCRIBED_IN]->(p:Publication) "
        "WHERE p.source_file IS NOT NULL "
        "WITH nodes, rels, p, collect(DISTINCT elementId(source_node)) AS linked_node_ids "
        "ORDER BY size(linked_node_ids) DESC, coalesce(p.year, 0) DESC, coalesce(p.title, '') ASC "
        "RETURN [node IN nodes | { "
        "  id: elementId(node), "
        "  label: labels(node)[0], "
        "  labels: labels(node), "
        "  name: coalesce(node.name, node.text, node.uid, 'Без названия'), "
        "  text: node.text "
        "}] AS nodes, "
        "[rel IN rels WHERE rel IS NOT NULL | { "
        "  id: elementId(rel), "
        "  source: elementId(startNode(rel)), "
        "  target: elementId(endNode(rel)), "
        "  type: type(rel) "
        "}] AS relationships, "
        "[source IN collect({ "
        "  uid: p.uid, "
        "  title: p.title, "
        "  year: p.year, "
        "  source_type: p.source_type, "
        "  country: p.country, "
        "  summary: p.summary, "
        "  link: p.link, "
        "  linked_node_ids: linked_node_ids "
        "}) WHERE source.uid IS NOT NULL] AS sources",
        limit=limit,
        seed_limit=max(10, limit // 2),
        search=search,
    )
    if not result:
        return {"nodes": [], "relationships": [], "sources": []}
    return result[0]
