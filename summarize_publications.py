import anthropic

from save_to_db import get_driver, NEO4J_DATABASE

SYSTEM_PROMPT = (
    "Ты — ассистент по построению графа знаний в области металлургии и обогащения руд. "
    "Тебе дают название, год и страну публикации научного источника. А так же извлеченные из него связи. "
    "Напиши сжатую выжимку (5-8 предложений) на русском: "
    "какие материалы, процессы и оборудование рассматриваются, ключевые условия и численные "
    "результаты (с единицами измерения), основной вывод. Без вступлений и общих слов."
)


def fetch_publications_without_summary(driver, limit: int = 20):
    query = """
    MATCH (p:Publication)
    WHERE p.summary IS NULL AND p.full_text IS NOT NULL
    RETURN p.uid AS uid, p.title AS title, p.full_text AS text
    LIMIT $limit
    """
    with driver.session(database=NEO4J_DATABASE) as session:
        return [dict(r) for r in session.run(query, limit=limit)]


def summarize(client: anthropic.Anthropic, title: str, text: str) -> str:
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Название: {title}\n\nТекст:\n{text}"}],
    )
    return next(b.text for b in response.content if b.type == "text")


def save_summary(driver, uid: str, summary: str):
    with driver.session(database=NEO4J_DATABASE) as session:
        session.run(
            "MATCH (p:Publication {uid: $uid}) SET p.summary = $summary",
            uid=uid, summary=summary,
        )


def main():
    client = anthropic.Anthropic()
    driver = get_driver()
    try:
        pubs = fetch_publications_without_summary(driver)
        if not pubs:
            print("Нет публикаций без summary (или отсутствует full_text).")
            return
        for pub in pubs:
            summary = summarize(client, pub["title"], pub["text"])
            save_summary(driver, pub["uid"], summary)
            print(f"[ok] {pub['uid']}: {summary[:80]}...")
    finally:
        driver.close()


if __name__ == "__main__":
    main()
