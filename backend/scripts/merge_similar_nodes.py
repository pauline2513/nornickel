import argparse
from collections import defaultdict
import re

DEFAULT_LABELS = ["Equipment", "Experiment", "Expert", "Facility", "Material", "Process"]
GRAPH_PREFIX = "entity_resolution"
REL_TYPE = "CANDIDATE_DUPLICATE"


def _run_one(query, **params):
    from .. import db

    rows = db.run(query, **params)
    return rows[0] if rows else {}


def _run(query, **params):
    from .. import db

    return db.run(query, **params)


def _check_gds():
    try:
        version = _run_one("RETURN gds.version() AS version").get("version")
    except Exception as e:
        raise SystemExit(
            "GDS is not available in Neo4j. Recreate/restart the neo4j "
            "container after adding graph-data-science to NEO4J_PLUGINS."
        ) from e
    print(f"[gds] version: {version}")


def _drop_graph(graph_name):
    _run("CALL gds.graph.drop($graph_name, false) YIELD graphName RETURN graphName", graph_name=graph_name)


def _project_label(label, graph_name):
    _drop_graph(graph_name)
    return _run_one(
        """
        MATCH (source)
        WHERE $label IN labels(source)
          AND source.embedding IS NOT NULL
          AND size(source.embedding) > 0
        WITH gds.graph.project(
            $graph_name,
            source,
            null,
            {
                sourceNodeLabels: $label,
                targetNodeLabels: null,
                sourceNodeProperties: source { .embedding },
                targetNodeProperties: null
            }
        ) AS g
        RETURN g.nodeCount AS node_count, g.relationshipCount AS relationship_count
        """,
        label=label,
        graph_name=graph_name,
    )

def clear_candidates():
    row = _run_one(
        f"""
        MATCH ()-[r:{REL_TYPE}]->()
        WHERE r.source = 'gds_knn'
        WITH count(r) AS rels, collect(r) AS rs
        FOREACH (r IN rs | DELETE r)
        RETURN rels
        """
    )
    return row.get("rels", 0)


def create_candidates_for_label(label, *, top_k, embedding_cutoff, candidate_cutoff):
    graph_name = f"{GRAPH_PREFIX}_{label.lower()}"
    projected = _project_label(label, graph_name)
    node_count = projected.get("node_count", 0)
    if node_count < 2:
        _drop_graph(graph_name)
        return {"label": label, "nodes": node_count, "candidates": 0}

    row = _run_one(
        f"""
        CALL gds.knn.stream($graph_name, {{
            nodeProperties: {{embedding: 'COSINE'}},
            topK: $top_k,
            similarityCutoff: $embedding_cutoff,
            randomSeed: 42,
            concurrency: 1
        }})
        YIELD node1, node2, similarity
        WITH gds.util.asNode(node1) AS a,
             gds.util.asNode(node2) AS b,
             similarity
        WHERE id(a) < id(b)
        WITH a, b, similarity,
             apoc.text.sorensenDiceSimilarity(
                 toString(coalesce(a.name, a.text, '')),
                 toString(coalesce(b.name, b.text, ''))
             ) AS name_similarity
        WITH a, b, similarity, name_similarity,
             0.85 * similarity + 0.15 * name_similarity AS hybrid_score
        WHERE similarity >= $candidate_cutoff
           OR hybrid_score >= $candidate_cutoff
        MERGE (a)-[r:{REL_TYPE}]->(b)
        SET r.source = 'gds_knn',
            r.label = $label,
            r.embedding_score = similarity,
            r.name_score = name_similarity,
            r.hybrid_score = hybrid_score,
            r.score = similarity,
            r.updated_at = datetime()
        RETURN count(r) AS candidates
        """,
        graph_name=graph_name,
        top_k=top_k,
        embedding_cutoff=embedding_cutoff,
        candidate_cutoff=candidate_cutoff,
        label=label,
    )
    _drop_graph(graph_name)
    return {"label": label, "nodes": node_count, "candidates": row.get("candidates", 0)}


def create_candidates(labels, *, top_k, embedding_cutoff, candidate_cutoff, keep_existing):
    _check_gds()
    if not keep_existing:
        removed = clear_candidates()
        print(f"[clear] removed old {REL_TYPE}: {removed}")

    total = 0
    for label in labels:
        stats = create_candidates_for_label(
            label,
            top_k=top_k,
            embedding_cutoff=embedding_cutoff,
            candidate_cutoff=candidate_cutoff,
        )
        total += stats["candidates"]
        print(f"[{label}] nodes={stats['nodes']} candidates={stats['candidates']}")
    print(f"[done] candidates={total}")


def list_candidates(limit):
    rows = _run(
        f"""
        MATCH (a)-[r:{REL_TYPE}]->(b)
        RETURN r.label AS label,
               coalesce(a.name, a.text) AS source,
               coalesce(b.name, b.text) AS target,
               round(r.score * 10000) / 10000.0 AS score,
               round(r.embedding_score * 10000) / 10000.0 AS embedding_score,
               round(r.hybrid_score * 10000) / 10000.0 AS hybrid_score,
               round(r.name_score * 10000) / 10000.0 AS name_score
        ORDER BY r.score DESC
        LIMIT $limit
        """,
        limit=limit,
    )
    for row in rows:
        print(
            f"{row['label']}: {row['source']} <-> {row['target']} "
            f"score={row['score']} emb={row['embedding_score']} "
            f"hybrid={row['hybrid_score']} name={row['name_score']}"
        )


class UnionFind:
    def __init__(self):
        self.parent = {}

    def find(self, item):
        self.parent.setdefault(item, item)
        if self.parent[item] != item:
            self.parent[item] = self.find(self.parent[item])
        return self.parent[item]

    def union(self, left, right):
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            self.parent[right_root] = left_root

    def groups(self):
        grouped = defaultdict(list)
        for item in self.parent:
            grouped[self.find(item)].append(item)
        return [items for items in grouped.values() if len(items) > 1]


def _merge_group(ids):
    nodes = _run(
        """
        MATCH (n)
        WHERE elementId(n) IN $ids
        RETURN elementId(n) AS id,
               coalesce(n.name, n.text) AS name,
               coalesce(n.aliases, []) AS aliases,
               count { (n)--() } AS degree
        """,
        ids=ids,
    )
    nodes.sort(key=lambda n: (-n["degree"], len(n["name"] or ""), n["name"] or ""))
    ordered_ids = [n["id"] for n in nodes]
    canonical_name = nodes[0]["name"]
    aliases = sorted(
        {
            value
            for node in nodes
            for value in [node["name"], *node["aliases"]]
            if value
        }
    )
    row = _run_one(
        """
        UNWIND range(0, size($ordered_ids) - 1) AS i
        MATCH (n)
        WHERE elementId(n) = $ordered_ids[i]
        WITH n, i
        ORDER BY i
        WITH collect(n) AS nodes
        CALL apoc.refactor.mergeNodes(nodes, {
            properties: 'discard',
            mergeRels: true,
            avoidDuplicates: true
        })
        YIELD node
        SET node.name = $canonical_name,
            node.aliases = apoc.coll.toSet(coalesce(node.aliases, []) + $aliases),
            node.merged_at = datetime(),
            node.merge_source = 'gds_knn'
        WITH node
        OPTIONAL MATCH (node)-[r:CANDIDATE_DUPLICATE]-(other)
        WHERE node = other
        DELETE r
        RETURN elementId(node) AS id, node.name AS name
        """,
        ordered_ids=ordered_ids,
        canonical_name=canonical_name,
        aliases=aliases,
    )
    return row

def _numbers(text):
    if not text:
        return set()
    return set(re.findall(r"\d+(?:[.,]\d+)?", text.lower()))


def _too_short_name(text, min_len=4):
    if not text:
        return True
    return len(text.strip()) < min_len


def _blocked_by_numbers(left, right):
    left_numbers = _numbers(left)
    right_numbers = _numbers(right)

    if left_numbers and right_numbers and left_numbers != right_numbers:
        return True

    return False


def _is_safe_merge_pair(left_name, right_name):
    if _too_short_name(left_name) or _too_short_name(right_name):
        return False

    if _blocked_by_numbers(left_name, right_name):
        return False

    return True

def merge_candidates(*, merge_cutoff, min_name_score, limit):
    rows = _run(
        f"""
        MATCH (a)-[r:{REL_TYPE}]-(b)
        WHERE r.score >= $merge_cutoff
          AND r.name_score >= $min_name_score
        RETURN elementId(a) AS a,
               elementId(b) AS b,
               coalesce(a.name, a.text) AS a_name,
               coalesce(b.name, b.text) AS b_name,
               r.score AS score,
               r.name_score AS name_score
        LIMIT $limit
        """,
        merge_cutoff=merge_cutoff,
        min_name_score=min_name_score,
        limit=limit,
    )

    uf = UnionFind()
    skipped = 0

    for row in rows:
        if not _is_safe_merge_pair(row["a_name"], row["b_name"]):
            skipped += 1
            print(
                f"[skip] {row['a_name']} <-> {row['b_name']} "
                f"emb={row['score']:.4f} name={row['name_score']:.4f}"
            )
            continue

        uf.union(row["a"], row["b"])

    groups = uf.groups()
    print(f"[merge] groups={len(groups)} skipped={skipped}")

    for ids in groups:
        merged = _merge_group(ids)
        print(f"[merge] {len(ids)} nodes -> {merged.get('name')}")


def parse_args():
    parser = argparse.ArgumentParser(description="Find and optionally merge similar entity nodes with Neo4j GDS kNN.")
    parser.add_argument("--labels", nargs="+", default=DEFAULT_LABELS, choices=DEFAULT_LABELS)
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--embedding-cutoff", type=float, default=0.97)
    parser.add_argument("--candidate-cutoff", type=float, default=0.885)
    parser.add_argument("--keep-existing", action="store_true")
    parser.add_argument("--list", type=int, default=30, help="Print top candidate pairs after candidate generation.")
    parser.add_argument("--merge", action="store_true", help="Merge high-confidence candidate groups.")
    parser.add_argument("--merge-only", action="store_true", help="Skip GDS and merge existing candidate relationships.")
    parser.add_argument("--merge-cutoff", type=float, default=0.97)
    parser.add_argument("--min-name-score", type=float, default=0.55)
    parser.add_argument("--merge-limit", type=int, default=10000)
    return parser.parse_args()


def main():
    args = parse_args()
    if not args.merge_only:
        create_candidates(
            args.labels,
            top_k=args.top_k,
            embedding_cutoff=args.embedding_cutoff,
            candidate_cutoff=args.candidate_cutoff,
            keep_existing=args.keep_existing,
        )
    if args.list and not args.merge_only:
        list_candidates(args.list)
    if args.merge or args.merge_only:
        merge_candidates(
            merge_cutoff=args.merge_cutoff,
            min_name_score=args.min_name_score,
            limit=args.merge_limit,
        )


if __name__ == "__main__":
    main()
