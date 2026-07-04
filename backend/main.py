import logging

from fastapi import FastAPI, HTTPException, Query
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


@app.get("/api/dataset")
def dataset() -> dict:
    from . import db

    return {"sources": db.fetch_all_sources()}


@app.get("/api/sources/{uid}/text")
def source_text(uid: str) -> dict:
    from . import db

    source_file = db.fetch_source_file(uid)
    if not source_file:
        raise HTTPException(status_code=404, detail="Источник не найден")

    data_dir = config.DATA_DIR.resolve()
    path = (data_dir / source_file).resolve()
    if path != data_dir and data_dir not in path.parents:
        raise HTTPException(status_code=400, detail="Некорректный путь к файлу источника")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Файл источника не найден")

    return {"text": path.read_text(encoding="utf-8", errors="replace")}


app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
