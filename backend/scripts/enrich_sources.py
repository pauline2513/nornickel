"""Суммаризация источников через Claude API.

Для каждого Publication с source_file, но без summary, ищет одноимённый
.txt в data/ и папке проекта, суммаризирует и пишет p.summary.

Запуск: python -m backend.scripts.enrich_sources
"""

from .. import config, db, llm


def main():
    pubs = db.run(
        "MATCH (p:Publication) "
        "WHERE p.summary IS NULL AND p.source_file IS NOT NULL "
        "RETURN p.uid AS uid, p.title AS title, p.source_file AS source_file"
    )
    if not pubs:
        print("Все источники уже суммаризированы (или нет Publication с source_file).")
        return

    for pub in pubs:
        candidates = [config.DATA_DIR / pub["source_file"],
                      config.PROJECT_ROOT / pub["source_file"]]
        path = next((p for p in candidates if p.exists()), None)
        if path is None:
            print(f"[skip] {pub['source_file']}: файл не найден (положите в data/)")
            continue
        text = path.read_text(encoding="utf-8")
        summary = llm.summarize_source(pub["title"], text)
        db.run(
            "MATCH (p:Publication {uid: $uid}) SET p.summary = $summary",
            uid=pub["uid"], summary=summary,
        )
        print(f"[ok] {pub['title']}: {summary[:90]}...")


if __name__ == "__main__":
    main()
