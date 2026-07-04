"""Все обращения к Claude API: извлечение сущностей из запроса,
проверка достаточности контекста, генерация ответа, суммаризация источника."""

import anthropic
from pydantic import BaseModel

from . import config

_client = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


# --------------------------------------------------------------------------
# 1. Ключевые сущности из запроса пользователя
# --------------------------------------------------------------------------

class QueryEntities(BaseModel):
    entities: list[str]


def extract_query_entities(query: str) -> list[str]:
    response = get_client().messages.parse(
        model=config.ANTHROPIC_MODEL,
        max_tokens=1024,
        system=(
            "Ты помогаешь искать по графу знаний в области металлургии и обогащения руд. "
            "Из запроса пользователя выдели ключевые сущности для поиска вершин графа: "
            "материалы, процессы, оборудование, свойства/условия, организации. "
            "Верни короткие термины на русском в именительном падеже (1-4 слова каждый), "
            "без дубликатов. Не выдумывай сущности, которых нет в запросе."
        ),
        messages=[{"role": "user", "content": query}],
        output_format=QueryEntities,
    )
    return response.parsed_output.entities


# --------------------------------------------------------------------------
# 2. Достаточно ли контекста для ответа
# --------------------------------------------------------------------------

class Sufficiency(BaseModel):
    sufficient: bool
    missing: str  # чего не хватает — попадает в лог, полезно для отладки


def check_sufficiency(query: str, context: str) -> Sufficiency:
    response = get_client().messages.parse(
        model=config.ANTHROPIC_MODEL,
        max_tokens=1024,
        system=(
            "Тебе дают запрос пользователя и фрагмент графа знаний (вершины и связи). "
            "Оцени, достаточно ли этой информации, чтобы содержательно ответить. "
            "sufficient=false только если в контексте реально не хватает ключевой информации "
            "и её могло бы дать расширение окрестности графа."
        ),
        messages=[{
            "role": "user",
            "content": f"Запрос: {query}\n\nКонтекст из графа:\n{context}",
        }],
        output_format=Sufficiency,
    )
    return response.parsed_output


# --------------------------------------------------------------------------
# 3. Финальный ответ
# --------------------------------------------------------------------------

def generate_answer(query: str, context: str) -> str:
    response = get_client().messages.create(
        model=config.ANTHROPIC_MODEL,
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=(
            "Ты — ассистент по графу знаний в области металлургии и обогащения руд. "
            "Отвечай на запрос пользователя, опираясь ТОЛЬКО на переданный контекст "
            "(вершины и связи графа). Если в контексте нет ответа — так и скажи. "
            "Отвечай на русском, по делу, без вступлений. "
            "Не перечисляй в ответе использованные вершины и источники — "
            "они показываются пользователю отдельно."
        ),
        messages=[{
            "role": "user",
            "content": f"Запрос: {query}\n\nКонтекст из графа:\n{context}",
        }],
    )
    return next(b.text for b in response.content if b.type == "text")


# --------------------------------------------------------------------------
# 4. Суммаризация источника (для узлов Publication)
# --------------------------------------------------------------------------

def summarize_source(title: str, text: str) -> str:
    response = get_client().messages.create(
        model=config.ANTHROPIC_MODEL,
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=(
            "Ты — ассистент по построению графа знаний в области металлургии. "
            "Тебе дают текст научного источника. Напиши сжатую выжимку (5-8 предложений) "
            "на русском: какие материалы, процессы и оборудование рассматриваются, "
            "ключевые условия и численные результаты (с единицами измерения), "
            "основной вывод. Без вступлений и общих слов."
        ),
        messages=[{
            "role": "user",
            "content": f"Название: {title}\n\nТекст:\n{text}",
        }],
    )
    return next(b.text for b in response.content if b.type == "text")
