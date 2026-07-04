# --- Стадия 1: сборка фронтенда ---
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Стадия 2: бэкенд + собранный фронтенд ---
FROM python:3.12-slim
WORKDIR /app

COPY requirements-docker.txt .
RUN pip install --no-cache-dir -r requirements-docker.txt

# Локальный фолбэк эмбеддингов: torch без CUDA + sentence-transformers.
# Сами веса BAAI/bge-m3 в образ не входят — их скачивает prestart при первом
# запуске на сервере, кэш хранится в volume (см. docker-compose.yaml)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir sentence-transformers==5.6.0

COPY backend/ backend/
COPY schema.cypher .
COPY --from=frontend /frontend/dist frontend/dist

EXPOSE 8000
# prestart: при пустом графе — ingest + enrich; его ошибка не мешает старту API
CMD ["sh", "-c", "python -m backend.scripts.prestart; exec uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
