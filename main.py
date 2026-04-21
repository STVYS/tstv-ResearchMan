import os
import time
from typing import Any, Optional

import httpx
from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MCP_API_KEY = os.getenv("MCP_API_KEY", "")

app = FastAPI(title="tstv-ResearchMan")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_api_key(x_api_key: Optional[str] = Header(default=None, alias="X-API-Key")) -> None:
    if not MCP_API_KEY:
        raise HTTPException(status_code=500, detail="MCP_API_KEY not configured on server")
    if not x_api_key or x_api_key != MCP_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "http_error", "detail": str(exc.detail)},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "detail": str(exc)},
    )


class QueryBody(BaseModel):
    query: str
    system: Optional[str] = None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "tstv-ResearchMan"}


@app.post("/research", dependencies=[Depends(verify_api_key)])
async def research(body: QueryBody) -> dict[str, Any]:
    if not PERPLEXITY_API_KEY:
        raise HTTPException(status_code=500, detail="PERPLEXITY_API_KEY not configured")

    start = time.time()
    messages: list[dict[str, str]] = []
    if body.system:
        messages.append({"role": "system", "content": body.system})
    messages.append({"role": "user", "content": body.query})

    payload = {
        "model": "sonar-pro",
        "temperature": 0,
        "messages": messages,
    }
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            "https://api.perplexity.ai/chat/completions",
            json=payload,
            headers=headers,
        )
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=f"Perplexity error: {resp.text}")

    data = resp.json()
    result_text = ""
    try:
        result_text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        result_text = ""

    citations: list[Any] = []
    if isinstance(data.get("citations"), list):
        citations = data["citations"]
    elif isinstance(data.get("search_results"), list):
        citations = data["search_results"]
    else:
        try:
            choice = data["choices"][0]
            if isinstance(choice.get("citations"), list):
                citations = choice["citations"]
        except (KeyError, IndexError, TypeError):
            citations = []

    return {
        "result": result_text,
        "citations": citations,
        "elapsed": round(time.time() - start, 3),
    }


@app.post("/analyze", dependencies=[Depends(verify_api_key)])
async def analyze(body: QueryBody) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    start = time.time()
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    )

    contents = [{"role": "user", "parts": [{"text": body.query}]}]
    payload: dict[str, Any] = {
        "contents": contents,
        "tools": [{"google_search": {}}],
        "generationConfig": {"temperature": 0},
    }
    if body.system:
        payload["systemInstruction"] = {"parts": [{"text": body.system}]}

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=f"Gemini error: {resp.text}")

    data = resp.json()

    result_text = ""
    try:
        parts = data["candidates"][0]["content"]["parts"]
        result_text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
    except (KeyError, IndexError, TypeError):
        result_text = ""

    citations: list[Any] = []
    try:
        grounding = data["candidates"][0].get("groundingMetadata", {})
        chunks = grounding.get("groundingChunks", []) or []
        for ch in chunks:
            web = ch.get("web") if isinstance(ch, dict) else None
            if isinstance(web, dict):
                citations.append({"title": web.get("title"), "uri": web.get("uri")})
    except (KeyError, IndexError, TypeError):
        citations = []

    return {
        "result": result_text,
        "citations": citations,
        "elapsed": round(time.time() - start, 3),
    }


@app.post("/brief", dependencies=[Depends(verify_api_key)])
async def brief(body: QueryBody) -> dict[str, Any]:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    start = time.time()
    client = Anthropic(api_key=ANTHROPIC_API_KEY)

    kwargs: dict[str, Any] = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 16000,
        "messages": [{"role": "user", "content": body.query}],
        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
    }
    if body.system:
        kwargs["system"] = body.system

    message = client.messages.create(**kwargs)

    result_text = ""
    citations: list[Any] = []
    for block in message.content:
        btype = getattr(block, "type", None)
        if btype == "text":
            text_val = getattr(block, "text", "") or ""
            result_text += text_val
            block_citations = getattr(block, "citations", None) or []
            for c in block_citations:
                if hasattr(c, "model_dump"):
                    citations.append(c.model_dump())
                else:
                    citations.append(c)
        elif btype == "web_search_tool_result":
            content = getattr(block, "content", None) or []
            for item in content:
                if hasattr(item, "model_dump"):
                    d = item.model_dump()
                else:
                    d = item
                if isinstance(d, dict):
                    citations.append(
                        {
                            "title": d.get("title"),
                            "url": d.get("url"),
                            "page_age": d.get("page_age"),
                        }
                    )

    return {
        "result": result_text,
        "citations": citations,
        "elapsed": round(time.time() - start, 3),
    }
