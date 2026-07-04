"""Загрузка предиктов Label Studio (*.pred.json) в Neo4j.

- Имена сущностей приводятся к каноничному виду (лемматизация), сырые
  написания копятся в aliases -> дубли схлопываются при MERGE.
- Property и Publication-упоминания мёржатся по hash(text).
- Каждой вершине проставляется эмбеддинг BGE-M3 (для скоринга в RAG).
- Все сущности документа получают связь DESCRIBED_IN на Publication источника.

Запуск: python -m backend.scripts.ingest "Проблемы_выделения_элементарной_серы.pred.json"
"""

import hashlib
import json
import sys
from pathlib import Path

from .. import config, db, embeddings
from ..canonicalize import canonical_name


def md5(s: str) -> str:
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def _node_key(label: str, raw: str):
    """Ключ дедупликации вершины: (label, канон.имя) либо (label, uid=hash)."""
    if label == "Property":
        return label, md5(raw.lower().strip())
    if label == "Publication":
        return label, md5(canonical_name(raw) or raw.lower().strip())
    canon = canonical_name(raw)
    return (label, canon) if canon else (None, None)


def _match_clause(var: str, label: str, key: str) -> tuple[str, dict]:
    if label in ("Property", "Publication"):
        return f"({var}:{label} {{uid: ${var}_v}})", {f"{var}_v": key}
    return f"({var}:{label} {{name: ${var}_v}})", {f"{var}_v": key}


def ingest_document(doc: dict) -> dict:
    source_file = doc["source_file"]
    pub_uid = md5(source_file)
    title = Path(source_file).stem.replace("_", " ")
    link = (doc.get("link") or "").strip() or None

    # --- Publication документа-источника ---
    db.run(
        "MERGE (p:Publication {uid: $uid}) "
        "SET p.title = coalesce(p.title, $title), p.source_file = $source_file, "
        "    p.link = coalesce($link, p.link)",
        uid=pub_uid, title=title, source_file=source_file, link=link,
    )

    # --- собираем сущности, дедуплицируем по каноничному ключу ---
    nodes: dict[tuple, dict] = {}
    id_to_key: dict[str, tuple] = {}
    skipped = 0
    for item in doc["result"]:
        if item.get("type") == "relation":
            continue
        value = item.get("value", {})
        raw = (value.get("text") or "").strip()
        labels = value.get("labels") or []
        label = labels[0] if labels else None
        if not raw or label not in config.ENTITY_LABELS | {"Publication"}:
            skipped += 1
            continue
        label_key, key = _node_key(label, raw)
        if label_key is None:
            skipped += 1
            continue
        id_to_key[item["id"]] = (label_key, key)
        node = nodes.setdefault((label_key, key), {
            "label": label_key,
            "key": key,
            "name": key if label_key not in ("Property", "Publication") else raw,
            "text": raw if label_key == "Property" else None,
            "aliases": set(),
        })
        node["aliases"].add(raw)

    # --- эмбеддинги пачкой ---
    entity_nodes = [n for n in nodes.values() if n["label"] != "Publication"]
    if entity_nodes:
        embs = embeddings.encode([n["text"] or n["name"] for n in entity_nodes])
        for node, emb in zip(entity_nodes, embs):
            node["embedding"] = emb.tolist()

    # --- запись вершин ---
    for node in nodes.values():
        aliases = sorted(node["aliases"])
        if node["label"] == "Publication":
            db.run(
                "MERGE (n:Publication {uid: $uid}) "
                "SET n.title = coalesce(n.title, $name), "
                "    n.aliases = apoc.coll.toSet(coalesce(n.aliases, []) + $aliases)",
                uid=node["key"], name=node["name"], aliases=aliases,
            )
        elif node["label"] == "Property":
            db.run(
                "MERGE (n:Property {uid: $uid}) "
                "SET n.name = $name, n.text = $text, n.embedding = $emb, "
                "    n.aliases = apoc.coll.toSet(coalesce(n.aliases, []) + $aliases)",
                uid=node["key"], name=node["text"], text=node["text"],
                emb=node["embedding"], aliases=aliases,
            )
        else:
            db.run(
                f"MERGE (n:{node['label']} {{name: $name}}) "
                "SET n.embedding = $emb, "
                "    n.aliases = apoc.coll.toSet(coalesce(n.aliases, []) + $aliases)",
                name=node["key"], emb=node["embedding"], aliases=aliases,
            )

    # --- DESCRIBED_IN документа-источника для всех сущностей ---
    for node in nodes.values():
        if node["label"] == "Publication":
            continue
        match, params = _match_clause("n", node["label"], node["key"])
        db.run(
            f"MATCH {match} MATCH (p:Publication {{uid: $pub_uid}}) "
            "MERGE (n)-[:DESCRIBED_IN]->(p)",
            pub_uid=pub_uid, **params,
        )

    # --- связи из предикта ---
    rel_count = 0
    for item in doc["result"]:
        if item.get("type") != "relation":
            continue
        rel_label = (item.get("labels") or [None])[0]
        rel_type = config.RELATION_TYPES.get(rel_label)
        src = id_to_key.get(item["from_id"])
        dst = id_to_key.get(item["to_id"])
        if not rel_type or not src or not dst:
            continue
        if item.get("direction") == "left":
            src, dst = dst, src
        m_a, p_a = _match_clause("a", *src)
        m_b, p_b = _match_clause("b", *dst)
        db.run(
            f"MATCH {m_a} MATCH {m_b} "
            f"MERGE (a)-[:{rel_type}]->(b)",
            **p_a, **p_b,
        )
        rel_count += 1

    return {
        "source": source_file,
        "nodes": len(nodes),
        "relations": rel_count,
        "skipped_spans": skipped,
    }


def main():
    paths = [Path(p) for p in sys.argv[1:]]
    if not paths:
        paths = sorted(config.PROJECT_ROOT.glob("*.pred.json")) + \
                sorted(config.DATA_DIR.glob("*.pred.json"))
    if not paths:
        print("Не найдено *.pred.json (укажите путь аргументом)")
        return

    db.apply_schema()
    for path in paths:
        docs = json.loads(path.read_text(encoding="utf-8"))
        for doc in docs:
            stats = ingest_document(doc)
            print(f"[ok] {stats['source']}: вершин {stats['nodes']}, "
                  f"связей {stats['relations']}, пропущено спанов {stats['skipped_spans']}")

    total = db.run("MATCH (n) RETURN count(n) AS c")[0]["c"]
    rels = db.run("MATCH ()-[r]->() RETURN count(r) AS c")[0]["c"]
    print(f"Итого в базе: {total} вершин, {rels} связей")


if __name__ == "__main__":
    main()
