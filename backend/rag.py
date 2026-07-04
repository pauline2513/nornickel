"""Graph RAG пайплайн:

запрос -> ЛЛМ выделяет сущности -> полнотекстовый поиск вершин
       -> скоринг BGE-M3, топ-K -> ЛЛМ: достаточно?
       -> нет: шаг вглубь от текущих вершин (соседи), снова скоринг -> ...
       -> да: генерация ответа.

Возвращает ответ + использованные вершины + источники (отдельными полями).
"""

import logging

from . import config, db, embeddings, llm

log = logging.getLogger(__name__)


def _format_context(nodes: list[dict], triples: list[dict]) -> str:
    lines = ["Вершины:"]
    for n in nodes:
        text = f" — {n['text']}" if n.get("text") and n["text"] != n["name"] else ""
        lines.append(f"- [{n['label']}] {n['name']}{text}")
    if triples:
        lines.append("\nСвязи:")
        for t in triples:
            lines.append(f"- ({t['source']}) -[{t['rel']}]-> ({t['target']})")
    return "\n".join(lines)


def _public_node(n: dict) -> dict:
    return {
        "id": n["id"],
        "label": n["label"],
        "name": n["name"],
        "text": n.get("text"),
        "score": round(n.get("score", 0.0), 4),
    }


def ask(query: str) -> dict:
    # 1. Ключевые сущности из запроса
    terms = llm.extract_query_entities(query)
    log.info("сущности из запроса: %s", terms)

    # 2. Кандидаты из полнотекстового индекса (+ сам запрос как поисковый терм)
    candidates: dict[str, dict] = {}
    for term in [*terms, query]:
        for node in db.fulltext_search(term):
            candidates.setdefault(node["id"], node)

    if not candidates:
        return {"answer": "В графе знаний не нашлось вершин по этому запросу.",
                "entities": terms, "used_nodes": [], "sources": []}

    # 3. Скоринг BGE-M3, топ-K
    query_emb = embeddings.encode([query])[0]
    ranked = embeddings.rank(query_emb, list(candidates.values()))
    used: dict[str, dict] = {n["id"]: n for n in ranked[: config.TOP_K]}

    # 4. Цикл: достаточно? нет -> вглубь
    expansions = 0
    while True:
        triples = db.fetch_triples(list(used))
        context = _format_context(list(used.values()), triples)
        verdict = llm.check_sufficiency(query, context)
        if verdict.sufficient or expansions >= config.MAX_EXPANSIONS:
            break
        expansions += 1
        log.info("контекста мало (%s), расширение #%d", verdict.missing, expansions)
        neighbors = [n for n in db.fetch_neighbors(list(used)) if n["id"] not in used]
        if not neighbors:
            break
        for n in embeddings.rank(query_emb, neighbors)[: config.TOP_K]:
            used[n["id"]] = n

    # 5. Ответ
    answer = llm.generate_answer(query, context)

    # 6. Источники использованных вершин
    sources = db.fetch_sources(list(used))

    return {
        "answer": answer,
        "entities": terms,
        "expansions": expansions,
        "used_nodes": [_public_node(n) for n in used.values()],
        "sources": sources,
    }
