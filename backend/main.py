import logging

from fastapi import FastAPI, Query
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
    return rag.ask(req.query)


@app.get("/api/health")
def health() -> dict:
    from . import db

    nodes = db.run("MATCH (n) RETURN count(n) AS c")[0]["c"]
    return {"status": "ok", "nodes_in_graph": nodes}


@app.get("/api/graph")
def graph(
    limit: int = Query(default=350, ge=20, le=1000),
    search: str = "",
) -> dict:
    from . import db

    return db.fetch_graph(
        limit=limit,
        search=search,
    )

app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
