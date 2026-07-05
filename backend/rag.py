import logging

from . import config, db, embeddings, llm
from .canonicalize import canonical_name

log = logging.getLogger(__name__)


def _format_context(nodes, triples):
    lines = ["Вершины:"]
    for n in nodes:
        text = f" — {n['text']}" if n.get("text") and n["text"] != n["name"] else ""
        lines.append(f"- [{n['label']}] {n['name']}{text}")
    if triples:
        lines.append("\nСвязи:")
        for t in triples:
            lines.append(f"- ({t['source']}) -[{t['rel']}]-> ({t['target']})")
    return "\n".join(lines)


def _public_node(n):
    return {
        "id": n["id"],
        "label": n["label"],
        "name": n["name"],
        "text": n.get("text"),
        "start": n.get("start"),
        "end": n.get("end"),
        "score": round(n.get("score", 0.0), 4),
    }


def _rank_publications(terms, pubs):
    lemmas = {w for t in terms for w in canonical_name(t).split()}
    for p in pubs:
        words = canonical_name(f"{p.get('title') or ''} {p.get('summary') or ''} "
                               f"{p.get('country') or ''}").split()
        p["match_score"] = sum(words.count(l) for l in lemmas)
    return sorted(pubs, key=lambda p: -p["match_score"])


def _ask_about_sources(query):

    terms = llm.extract_query_entities(query)
    pubs = db.fetch_publications_with_summary()
    if not pubs:
        return {"answer": "В базе пока нет источников с кратким содержанием "
                          "(запустите backend.scripts.enrich_sources).",
                "entities": terms, "expansions": 0, "used_nodes": [], "sources": []}

    ranked = _rank_publications(terms, pubs)
    top = [p for p in ranked if p["match_score"] >= 0][: config.SOURCE_TOP_K] \
        or ranked[: config.SOURCE_TOP_K]

    lines = ["Источники:"]
    for p in top:
        year = f", {p['year']}" if p.get("year") else ""
        country = f", страна: {p['country']}" if p.get("country") else ""
        actualized = f", дата актуализации: {p['actualization_date']}" \
            if p.get("actualization_date") else ""
        lines.append(f"- «{p['title']}»{year}{country}{actualized}: {p['summary']}")
    answer = llm.generate_answer(query, "\n".join(lines))

    for p in top:
        p.pop("match_score", None)
        p["used_nodes_count"] = 0
    return {"answer": answer, "entities": terms, "expansions": 0,
            "used_nodes": [], "sources": top}


def ask(query):

    if llm.is_source_query(query):
        log.info("запрос про источники -> поиск по summary публикаций")
        return _ask_about_sources(query)

    terms = llm.extract_query_entities(query)
    log.info("сущности из запроса: %s", terms)

    candidates: dict[str, dict] = {}
    for term in [*terms, query]:
        for node in db.fulltext_search(term):
            candidates.setdefault(node["id"], node)

    if not candidates:
        return {"answer": "В графе знаний не нашлось вершин по этому запросу.",
                "entities": terms, "used_nodes": [], "sources": []}

    query_emb = embeddings.encode([query], text_type="query")[0]
    ranked = embeddings.rank(query_emb, list(candidates.values()))
    used: dict[str, dict] = {n["id"]: n for n in ranked[: config.TOP_K]}

    expansions = 0
    while True:
        triples = db.fetch_triples(list(used))
        context = _format_context(list(used.values()), triples)
        verdict = llm.check_sufficiency(query, context)
        if verdict.sufficient or expansions >= config.MAX_EXPANSIONS:
            break
        expansions += 1
        neighbors = [n for n in db.fetch_neighbors(list(used)) if n["id"] not in used]
        if not neighbors:
            break
        for n in embeddings.rank(query_emb, neighbors)[: config.TOP_K]:
            used[n["id"]] = n

    answer = llm.generate_answer(query, context)

    sources = db.fetch_sources(list(used))

    return {
        "answer": answer,
        "entities": terms,
        "expansions": expansions,
        "used_nodes": [_public_node(n) for n in used.values()],
        "sources": sources,
    }
