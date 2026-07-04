"""FastAPI: чат-эндпоинт + раздача фронтенда.

Запуск:  uvicorn backend.main:app --reload
Открыть: http://localhost:8000
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, rag

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Nornickel KG RAG")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    query: str


@app.post("/api/chat")
def chat(req: ChatRequest) -> dict:
    """Возвращает {answer, entities, expansions, used_nodes[], sources[]}."""
    return rag.ask(req.query)


@app.get("/api/health")
def health() -> dict:
    from . import db

    nodes = db.run("MATCH (n) RETURN count(n) AS c")[0]["c"]
    return {"status": "ok", "nodes_in_graph": nodes}


# фронтенд (в самом конце, чтобы не перехватывал /api/*)
app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
