"""Все обращения к API: извлечение сущностей из запроса,
проверка достаточности контекста, генерация ответа, суммаризация источника."""

from pydantic import BaseModel

from . import config

import os
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("MODEL_API_KEY"),
)


class QueryEntities(BaseModel):
    entities: list[str]


class Sufficiency(BaseModel):
    sufficient: bool


class SourceQuery(BaseModel):
    about_sources: bool



SYSTEM_FIRST_ENTITY_EXTRACTION_PROMPT = """
Ты - LLM для работы с извлечением информацией для пользователя. Тебе будут поступать запросы о металлургии и металах.
По запросу тебе необходимо определить ключевые слова и фразы по которым будет осуществляться поиск в вершинах графа для данного запроса. Верни их списком строк в поле entities.
В качестве ключевых слов можно так же использовать синонимы или формульные обозначения. В области металлургии особенно важно. Например, медь может быть и медь и Cu, ниобиум Nb и так далее.
Слова извлекай в начальной форме!
Например:
Q: Сколько градусов необходимо установить в печи чтобы расплавить медь?
A: ["градус", "°", "печь", "медь"]
Q: Сколько меди содержится в сплаве?
A: ["медь", "Cu", "сплав"]
Q: Какие особые элементы образуются при плавке?
A: ["элементы", "плавка"]
Q: Чем характеризуется плавка при высоких температурах?
A: ["плавка", "температура"]
"""


SYSTEM_PROMPT_FOR_EVALUATION = """
Ты - LLM для работы с извлечением информацией для пользователя. Тебе необходимо ответить на вопрос достаточно ли информации для ответа на запрос пользователя.
Не требуй полного обхода графа, делай это только в случаях когда информации правда недостаточно.
Не продолжай поиск связанных химических элементов, если пользователь спрашивает только о содержании одного элемента.
В ответе укажи только True или False.
"""

SYSTEM_PROMPT_FOR_ANSWERING = """
Ты - модель для ответа на пользовательские вопросы о металлургии.
Ниже даны найденные пути и фреймы из графа. Тебе нужно обязательно сформулировать лучший возможный ответ по этому контексту (вершины и связи графа). Если в контексте нет ответа — так и скажи.
Не используй общие знания вне контекста. 
Отвечай коротко и по сути вопроса.
"""


SYSTEM_PROMPT_FOR_SOURCE_DETECTION = """
Ты — классификатор запросов к системе поиска по графу знаний о металлургии.
Определи, спрашивает ли пользователь про сами источники (публикации, статьи, патенты, отчёты):
какие есть источники по теме, где что-то описано, что почитать, откуда данные. Тогда about_sources = true.
Если это содержательный вопрос про металлургию (процессы, материалы, условия, оборудование) — about_sources = false.
Например:
Q: Какие есть статьи про электроэкстракцию никеля? -> true
Q: В каких источниках описаны проблемы выделения серы? -> true
Q: При какой температуре ведут обжиг концентрата? -> false
Q: Какое оборудование используется для плавки? -> false
"""


SYSTEM_PROMPT_FOR_SUMMARIZATION = """
Ты — ассистент по построению графа знаний в области металлургии.
Тебе дают текст научного источника. Напиши сжатую выжимку (5-8 предложений) на русском: 
какие материалы, процессы и оборудование рассматриваются, ключевые условия и численные результаты (с единицами измерения), основной вывод. 
Без вступлений и общих слов.
"""

# --------------------------------------------------------------------------
# 1. Ключевые сущности из запроса пользователя
# --------------------------------------------------------------------------


def extract_query_entities(query: str) -> list[str]:

    response = client.chat.completions.parse(
        model=config.MODEL,
        messages=[{"role": "system", "content": SYSTEM_FIRST_ENTITY_EXTRACTION_PROMPT},
                  {"role": "user", "content": query}],
        response_format=QueryEntities,
    )
    print(response.choices[0].message.parsed.entities)
    return response.choices[0].message.parsed.entities


# --------------------------------------------------------------------------
# 1b. Запрос про источники (публикации), а не про сам граф?
# --------------------------------------------------------------------------


def is_source_query(query: str) -> bool:
    response = client.chat.completions.parse(
        model=config.MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT_FOR_SOURCE_DETECTION},
                  {"role": "user", "content": query}],
        response_format=SourceQuery,
    )
    print("about_sources:", response.choices[0].message.parsed.about_sources)
    return response.choices[0].message.parsed.about_sources


# --------------------------------------------------------------------------
# 2. Достаточно ли контекста для ответа
# --------------------------------------------------------------------------


def check_sufficiency(query: str, context: str) -> Sufficiency:
    response = client.chat.completions.parse(
        model=config.MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT_FOR_EVALUATION},
                  {"role": "user", "content": f"Запрос: {query}\n\nКонтекст из графа:\n{context}"}],
        response_format=Sufficiency,
    )
    print(response.choices[0].message.parsed.sufficient)
    return response.choices[0].message.parsed


# --------------------------------------------------------------------------
# 3. Финальный ответ
# --------------------------------------------------------------------------

def generate_answer(query: str, context: str) -> str:
    response = client.chat.completions.create(
        model=config.MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT_FOR_ANSWERING},
                  {"role": "user", "content": f"Запрос: {query}\n\nКонтекст из графа:\n{context}"}],
    )
    print(response.choices[0].message.content)
    return response.choices[0].message.content


# --------------------------------------------------------------------------
# 4. Суммаризация источника (для узлов Publication)
# --------------------------------------------------------------------------

def summarize_source(title: str, text: str) -> str:
    response = client.chat.completions.create(
        model=config.MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT_FOR_SUMMARIZATION},
                  {"role": "user", "content": f"Название: {title}\n\nТекст:\n{text}"}],
    )
    print(response.choices[0].message.content)
    return response.choices[0].message.content
