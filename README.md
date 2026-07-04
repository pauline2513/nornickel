# Граф знаний по металлургии + Graph RAG чат

Пайплайн: предикты Label Studio (`*.pred.json`) → Neo4j (канонизация вершин, эмбеддинги)
→ FastAPI-бэкенд с Graph RAG → веб-чат, который показывает ответ, использованные
вершины графа и источники.

## Структура

```
├── docker-compose.yaml        Neo4j 5 + APOC (порты 7475 http / 7688 bolt)
├── schema.cypher              схема графа: constraints, индексы (полнотекст + векторные)
├── requirements.txt
├── data/                      сюда кладутся исходные .txt (для суммаризации) и .pred.json
├── backend/
│   ├── config.py              все настройки (env-переменные, параметры RAG)
│   ├── db.py                  Neo4j: подключение + запросы чтения для RAG
│   ├── canonicalize.py        лемматизация имён (pymorphy3) — схлопывание дублей
│   ├── embeddings.py          BAAI/bge-m3: кодирование и скоринг вершин
│   ├── llm.py                 Claude API: сущности из запроса, достаточность, ответ, суммаризация
│   ├── rag.py                 Graph RAG пайплайн (поиск → скоринг → расширение → ответ)
│   ├── main.py                FastAPI: POST /api/chat, /api/health, раздача фронтенда
│   └── scripts/
│       ├── ingest.py          загрузка *.pred.json в Neo4j
│       └── enrich_sources.py  суммаризация источников (пишет Publication.summary)
└── frontend/                  React + TypeScript + antd (Vite), см. frontend/README.md
    ├── src/
    │   ├── api/chat.ts         вызов /api/chat — сейчас заглушка с mock-данными
    │   ├── components/         чат: пустой экран, пузыри сообщений, чипы вершин, источники
    │   └── App.tsx
    └── dist/                  production-сборка (npm run build), её раздаёт backend/main.py
```

## Запуск

```powershell
# 1. БД
docker compose up -d

# 2. Зависимости (в venv)
pip install -r requirements.txt

# 3. Ключ Claude API
$env:ANTHROPIC_API_KEY = "sk-ant-..."

# 4. Загрузка извлечений в граф (применит schema.cypher, при первом запуске скачает bge-m3)
python -m backend.scripts.ingest "Проблемы_выделения_элементарной_серы.pred.json"

# 5. (опционально) суммаризация источников — .txt должны лежать в data/
python -m backend.scripts.enrich_sources

# 6. Фронтенд: сборка (или см. ниже режим разработки)
cd frontend
npm install
npm run build
cd ..

# 7. Бэкенд + собранный фронтенд
uvicorn backend.main:app --reload
# открыть http://localhost:8000
```

### Фронтенд в режиме разработки

Backend-модель (Graph RAG) пока не готова полностью, поэтому чат-эндпоинт на
фронтенде замокан (`frontend/src/api/chat.ts`) — раздаёт заготовленные
ответы в том же формате, что и реальный `/api/chat`. Это позволяет
разрабатывать и демонстрировать интерфейс независимо от backend:

```powershell
cd frontend
npm install
npm run dev
# открыть http://localhost:5173
```

Когда backend-модель будет готова, в `frontend/src/api/chat.ts` нужно
заменить тело `askChat()` на реальный `fetch("/api/chat", …)` — комментарий
с готовым кодом уже есть в файле. Dev-сервер Vite уже настроен проксировать
`/api/*` на `http://localhost:8000`.

## Как работает RAG (backend/rag.py)

1. Пользователь пишет запрос в чат → `POST /api/chat {query}`.
2. Claude извлекает из запроса ключевые сущности (structured output).
3. По каждой сущности — fuzzy-поиск вершин в полнотекстовом индексе `entity_names`.
4. Кандидаты скорятся BGE-M3 (косинус к эмбеддингу запроса), берётся топ-10.
5. Claude решает: достаточно ли контекста (вершины + связи между ними)?
   Нет → берём соседей текущих вершин (шаг вглубь), скорим, добавляем топ,
   спрашиваем снова (максимум `MAX_EXPANSIONS` раз).
6. Claude генерирует ответ только по контексту графа.
7. Ответ фронтенду отдельными полями JSON:

```json
{
  "answer": "...",
  "entities": ["элементарная сера", "..."],
  "expansions": 1,
  "used_nodes": [{"id": "...", "label": "Material", "name": "сера", "text": null, "score": 0.83}],
  "sources":    [{"uid": "...", "title": "...", "year": null, "source_type": null,
                  "country": null, "summary": "...", "used_nodes_count": 7}]
}
```

## Канонизация вершин

При загрузке имя каждой сущности лемматизируется («Сжигание элементарной серы» →
«сжигание элементарный сера») и используется как ключ `MERGE` — разные написания
схлопываются в одну вершину, все исходные варианты сохраняются в `aliases`.
Property и Publication-упоминания мёржатся по hash от текста.
Слияние оставшихся дублей вручную: `merge_duplicates()` в `save_to_db.py` (APOC).
