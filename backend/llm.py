from pydantic import BaseModel

from . import config

import os
from openai import OpenAI

client = OpenAI(
    base_url=config.MODEL_BASE_URL,
    api_key=os.environ.get("MODEL_API_KEY"),
)

fallback_client = None
if config.FALLBACK_API_KEY and config.FALLBACK_MODEL:
    fallback_client = OpenAI(
        base_url=config.FALLBACK_BASE_URL,
        api_key=config.FALLBACK_API_KEY,
    )


def with_fallback(call):
    """Выполняет call(client, model); при ошибке основной модели повторяет на запасной."""
    try:
        return call(client, config.MODEL)
    except Exception as e:
        if fallback_client is None:
            raise
        print(f"[llm] {config.MODEL} недоступна ({type(e).__name__}: {e}), "
              f"переключаюсь на {config.FALLBACK_MODEL}")
        return call(fallback_client, config.FALLBACK_MODEL)


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
Ниже даны найденные пути и фреймы из графа. Тебе нужно обязательно сформулировать лучший возможный ответ по этому контексту (вершины и связи графа). 
Если в контексте нет ответа — так и скажи. Не используй общие знания.
Не используй общие знания вне контекста.
Отвечай коротко и по сути вопроса. Не используй вводные фразы, например 'как видно из графа...', 'в результате анализа...' и т.д.
"""


SYSTEM_PROMPT_FOR_SOURCE_DETECTION = """
Ты — классификатор запросов к системе поиска по графу знаний о металлургии.
Определи, спрашивает ли пользователь про сами источники (публикации, статьи, патенты, отчёты):
какие есть источники по теме, где что-то описано, что почитать, откуда данные. Тогда about_sources = true.
Также about_sources = true, если вопрос про свойства источников: страны, где ведутся исследования
и разработки, сводки/обзоры исследований (в том числе по странам), даты актуализации, литературный обзор.
Если это содержательный вопрос про металлургию (процессы, материалы, условия, оборудование) — about_sources = false.
Например:
Q: Какие есть статьи про электроэкстракцию никеля?
A: true
Q: В каких источниках описаны проблемы выделения серы?
A: true
Q: Сделай сводку по разработкам по странам
A: true
Q: Сделай сводку по времени данных
A: true
Q: Приведи последние исследования
A: true
Q: Какие исследования ведутся в разных странах?
A: true
Q: При какой температуре ведут обжиг концентрата?
A: false
Q: Какое оборудование используется для плавки?
A: false
"""


SYSTEM_PROMPT_FOR_SUMMARIZATION = """
Ты — ассистент по построению графа знаний в области металлургии.
Тебе дают текст научного источника. Напиши сжатую выжимку (2-3 предложений) на русском или английском в зависимости от языка статьи:
какие материалы, процессы и оборудование рассматриваются, ключевые условия и численные результаты (с единицами измерения), основной вывод.
Без вступлений и общих слов. Должно быть коротко и по делу.
"""



def extract_query_entities(query):

    response = with_fallback(lambda client, model: client.chat.completions.parse(
        model=model,
        messages=[{"role": "system", "content": SYSTEM_FIRST_ENTITY_EXTRACTION_PROMPT},
                  {"role": "user", "content": query}],
        response_format=QueryEntities,
        temperature=0.2,
        top_p=0.8,
        presence_penalty=1.5,
        extra_body={
            "top_k": 20,
            "chat_template_kwargs": {"enable_thinking": False},
        },
    ))
    print(response.choices[0].message.parsed.entities)
    return response.choices[0].message.parsed.entities


def is_source_query(query):
    response = with_fallback(lambda client, model: client.chat.completions.parse(
        model=model,
        messages=[{"role": "system", "content": SYSTEM_PROMPT_FOR_SOURCE_DETECTION},
                  {"role": "user", "content": query}],
        response_format=SourceQuery,
        temperature=0.2,
        top_p=0.8,
        presence_penalty=1.5,
        extra_body={
            "top_k": 20,
            "chat_template_kwargs": {"enable_thinking": False},
        },
    ))
    print("about_sources:", response.choices[0].message.parsed.about_sources)
    return response.choices[0].message.parsed.about_sources

def check_sufficiency(query, context):
    response = with_fallback(lambda client, model: client.chat.completions.parse(
        model=model,
        messages=[{"role": "system", "content": SYSTEM_PROMPT_FOR_EVALUATION},
                  {"role": "user", "content": f"Запрос: {query}\n\nКонтекст из графа:\n{context}"}],
        response_format=Sufficiency,
        temperature=0.2,
        top_p=0.8,
        presence_penalty=1.5,
        extra_body={
            "top_k": 20,
            "chat_template_kwargs": {"enable_thinking": False},
        },
    ))
    print(response.choices[0].message.parsed.sufficient)
    return response.choices[0].message.parsed

def generate_answer(query, context):
    response = with_fallback(lambda client, model: client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": SYSTEM_PROMPT_FOR_ANSWERING},
                  {"role": "user", "content": f"Запрос: {query}\n\nКонтекст из графа:\n{context}"}],
        temperature=0.3,
        top_p=0.8,
        presence_penalty=1.5,
        extra_body={
            "top_k": 20,
            "chat_template_kwargs": {"enable_thinking": False},
        },
        max_completion_tokens=10000
    ))
    print(response.choices[0].message.content)
    return response.choices[0].message.content


def summarize_source(title, text):
    response = with_fallback(lambda client, model: client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": SYSTEM_PROMPT_FOR_SUMMARIZATION},
                  {"role": "user", "content": f"Название: {title}\n\nТекст:\n{text}"}],
        temperature=0.3,
        top_p=0.8,
        presence_penalty=1.5,
        extra_body={
            "top_k": 20,
            "chat_template_kwargs": {"enable_thinking": False},
        },
    ))
    print(response.choices[0].message.content)
    return response.choices[0].message.content
