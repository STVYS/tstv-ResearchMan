import asyncio
import os
import re
import time
from pathlib import Path
from typing import Any, Optional

import httpx
from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

load_dotenv()

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MCP_API_KEY = os.getenv("MCP_API_KEY", "")

RESEARCH_SYSTEM_DEFAULT = (
    "모든 응답은 원문 그대로 인용. 의역 금지. "
    "각 팩트마다 출처 URL과 원문 발췌를 즉시 표기. "
    "추측이나 일반론 금지. 확인 불가한 정보는 '미확인' 표기."
)

ANALYZE_SYSTEM_DEFAULT = (
    "원문 그대로 인용. 의역 금지. "
    "PDF/영상에서 추출한 내용은 페이지/타임스탬프 포함. "
    "출처 URL과 원문 발췌 즉시 표기. "
    "기술 클레임은 검증 가능한 근거와 함께 제시."
)

BRIEF_SYSTEM_DEFAULT = (
    "나는 한화로보틱스 기획팀 소속이다. "
    "담당: 로봇 파트너십 기획, AI 구현, 텔레오퍼레이션 리드암 디바이스. "
    "경력: LS Electric 10년 (해외영업→전략기획→전략마케팅). "
    "선호: 팩트 기반, 비판적 관점, 비주류 시각, 예상 밖 프레임. "
    "불확실한 정보는 반드시 '미확인' 표기. 통념 반복 금지. "
    "각 주장마다 근거와 출처 명시."
)

PERPLEXITY_MODELS = {"sonar", "sonar-pro", "sonar-deep-research"}
GEMINI_MODELS = {"gemini-2.5-flash", "gemini-2.5-pro"}

URL_REGEX = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)

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
    model: Optional[str] = None


def _classify_url(url: str) -> Optional[tuple[str, str]]:
    cleaned = url.rstrip(".,;)\"'")
    lower = cleaned.lower()
    if "youtube.com" in lower or "youtu.be" in lower:
        return (cleaned, "video/*")
    if lower.endswith(".pdf") or ".pdf?" in lower:
        return (cleaned, "application/pdf")
    return None


async def _do_research(
    query: str, system: Optional[str], model: Optional[str]
) -> dict[str, Any]:
    if not PERPLEXITY_API_KEY:
        raise HTTPException(status_code=500, detail="PERPLEXITY_API_KEY not configured")

    chosen_model = model if model in PERPLEXITY_MODELS else "sonar-pro"
    sys_prompt = system if system else RESEARCH_SYSTEM_DEFAULT

    start = time.time()
    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": query},
    ]
    payload = {"model": chosen_model, "temperature": 0, "messages": messages}
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
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


async def _do_analyze(
    query: str, system: Optional[str], model: Optional[str]
) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    chosen_model = model if model in GEMINI_MODELS else "gemini-2.5-pro"
    sys_prompt = system if system else ANALYZE_SYSTEM_DEFAULT

    start = time.time()
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{chosen_model}:generateContent?key={GEMINI_API_KEY}"
    )

    found_urls = URL_REGEX.findall(query)
    file_parts: list[dict[str, Any]] = []
    for u in found_urls:
        cls = _classify_url(u)
        if cls:
            uri, mime = cls
            file_parts.append({"fileData": {"fileUri": uri, "mimeType": mime}})

    parts: list[dict[str, Any]] = [{"text": query}]
    parts.extend(file_parts)
    contents = [{"role": "user", "parts": parts}]

    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": 0},
        "systemInstruction": {"parts": [{"text": sys_prompt}]},
    }
    if not file_parts:
        payload["tools"] = [{"google_search": {}}]

    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=f"Gemini error: {resp.text}")

    data = resp.json()

    result_text = ""
    try:
        parts_out = data["candidates"][0]["content"]["parts"]
        result_text = "".join(p.get("text", "") for p in parts_out if isinstance(p, dict))
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

    for fp in file_parts:
        fd = fp.get("fileData", {})
        citations.append({"title": "user-provided", "uri": fd.get("fileUri")})

    return {
        "result": result_text,
        "citations": citations,
        "elapsed": round(time.time() - start, 3),
    }


async def _do_brief(query: str, system: Optional[str]) -> dict[str, Any]:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    sys_prompt = system if system else BRIEF_SYSTEM_DEFAULT

    start = time.time()
    client = Anthropic(api_key=ANTHROPIC_API_KEY)

    kwargs: dict[str, Any] = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 16000,
        "system": sys_prompt,
        "messages": [{"role": "user", "content": query}],
        "tools": [{"type": "web_search_20250305", "name": "web_search"}],
    }

    message = await asyncio.to_thread(lambda: client.messages.create(**kwargs))

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


async def _do_full_research(query: str) -> dict[str, Any]:
    start = time.time()
    research_res, analyze_res = await asyncio.gather(
        _do_research(query, None, None),
        _do_analyze(query, None, None),
    )

    combined = (
        f"[원본 질문]\n{query}\n\n"
        f"[Perplexity 조사 결과]\n{research_res.get('result', '')}\n\n"
        f"[Gemini 분석 결과]\n{analyze_res.get('result', '')}\n\n"
        "위 두 결과를 취합해 충돌/공백/핵심 인사이트를 정리해줘. "
        "원문 인용 유지, 미확인 정보는 명시."
    )

    brief_res = await _do_brief(combined, None)

    all_citations: list[Any] = []
    all_citations.extend(research_res.get("citations", []))
    all_citations.extend(analyze_res.get("citations", []))
    all_citations.extend(brief_res.get("citations", []))

    return {
        "result": brief_res.get("result", ""),
        "citations": all_citations,
        "elapsed": round(time.time() - start, 3),
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "tstv-ResearchMan"}


@app.post("/research", dependencies=[Depends(verify_api_key)])
async def research(body: QueryBody) -> dict[str, Any]:
    return await _do_research(body.query, body.system, body.model)


@app.post("/analyze", dependencies=[Depends(verify_api_key)])
async def analyze(body: QueryBody) -> dict[str, Any]:
    return await _do_analyze(body.query, body.system, body.model)


@app.post("/brief", dependencies=[Depends(verify_api_key)])
async def brief(body: QueryBody) -> dict[str, Any]:
    return await _do_brief(body.query, body.system)


# ---------------- MCP endpoint (pure FastAPI, JSON-RPC 2.0) ----------------
_MCP_PROTOCOL_VERSION = "2024-11-05"
_MCP_SERVER_INFO = {"name": "tstv-ResearchMan", "version": "1.0.0"}

_TOOL_INPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {"type": "string", "description": "질문 또는 리서치 주제"}
    },
    "required": ["query"],
}

_EMPTY_INPUT_SCHEMA = {
    "type": "object",
    "properties": {},
    "required": [],
}

_UI_FILE_PATH = Path(__file__).parent / "research-man-trigger.jsx"

_MCP_TOOLS = [
    {
        "name": "research_man_search",
        "description": "Perplexity sonar-pro 기반 팩트 조사 (원문 인용, citations 포함)",
        "inputSchema": _TOOL_INPUT_SCHEMA,
    },
    {
        "name": "research_man_analyze",
        "description": "Gemini 2.5 Pro 기반 심층 분석. query 안의 PDF/YouTube URL 자동 인식, 없으면 Google Search grounding.",
        "inputSchema": _TOOL_INPUT_SCHEMA,
    },
    {
        "name": "research_man_brief",
        "description": "Claude Sonnet 4.6 + web_search 기반 전략 브리핑 (한화로보틱스 기획팀 페르소나).",
        "inputSchema": _TOOL_INPUT_SCHEMA,
    },
    {
        "name": "research_man_full",
        "description": "Perplexity + Gemini 병렬 실행 후 Claude가 취합/브리핑.",
        "inputSchema": _TOOL_INPUT_SCHEMA,
    },
    {
        "name": "research_man_ui",
        "description": "리서치맨 조사 조건 선택 UI를 반환. Claude가 아티팩트로 렌더링함.",
        "inputSchema": _EMPTY_INPUT_SCHEMA,
    },
]


async def _mcp_call_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name == "research_man_ui":
        try:
            content = _UI_FILE_PATH.read_text(encoding="utf-8")
            return {"content": [{"type": "text", "text": content}]}
        except Exception as e:
            return {
                "content": [{"type": "text", "text": f"error reading UI file: {e}"}],
                "isError": True,
            }

    query = (arguments or {}).get("query", "")
    if not query:
        return {
            "content": [{"type": "text", "text": "error: 'query' is required"}],
            "isError": True,
        }

    if name == "research_man_search":
        res = await _do_research(query, None, None)
    elif name == "research_man_analyze":
        res = await _do_analyze(query, None, None)
    elif name == "research_man_brief":
        res = await _do_brief(query, None)
    elif name == "research_man_full":
        res = await _do_full_research(query)
    else:
        return {
            "content": [{"type": "text", "text": f"error: unknown tool '{name}'"}],
            "isError": True,
        }

    text = res.get("result", "") or ""
    citations = res.get("citations", []) or []
    if citations:
        text += "\n\n[Citations]\n" + "\n".join(f"- {c}" for c in citations)
    return {"content": [{"type": "text", "text": text}]}


async def _mcp_handle_rpc(payload: dict[str, Any]) -> Optional[dict[str, Any]]:
    method = payload.get("method")
    req_id = payload.get("id")
    params = payload.get("params") or {}
    is_notification = "id" not in payload

    def ok(result: Any) -> dict[str, Any]:
        return {"jsonrpc": "2.0", "id": req_id, "result": result}

    def err(code: int, msg: str) -> dict[str, Any]:
        return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": msg}}

    try:
        if method == "initialize":
            return ok(
                {
                    "protocolVersion": _MCP_PROTOCOL_VERSION,
                    "capabilities": {"tools": {}},
                    "serverInfo": _MCP_SERVER_INFO,
                }
            )
        if method in ("notifications/initialized", "initialized"):
            return None
        if method == "tools/list":
            return ok({"tools": _MCP_TOOLS})
        if method == "tools/call":
            tool_name = params.get("name", "")
            arguments = params.get("arguments") or {}
            result = await _mcp_call_tool(tool_name, arguments)
            return ok(result)
        if method == "ping":
            return ok({})
        if is_notification:
            return None
        return err(-32601, f"Method not found: {method}")
    except HTTPException as e:
        return err(-32000, str(e.detail))
    except Exception as e:
        return err(-32000, str(e))


def _check_mcp_auth(request: Request) -> None:
    provided = request.headers.get("x-api-key") or request.query_params.get("api_key")
    if not MCP_API_KEY or provided != MCP_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@app.post("/mcp")
async def mcp_post(request: Request):
    _check_mcp_auth(request)
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse(
            {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}},
            status_code=400,
        )

    if isinstance(payload, list):
        responses: list[dict[str, Any]] = []
        for item in payload:
            if isinstance(item, dict):
                r = await _mcp_handle_rpc(item)
                if r is not None:
                    responses.append(r)
        if not responses:
            return Response(status_code=202)
        return JSONResponse(responses)

    if not isinstance(payload, dict):
        return JSONResponse(
            {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Invalid Request"}},
            status_code=400,
        )

    response = await _mcp_handle_rpc(payload)
    if response is None:
        return Response(status_code=202)
    return JSONResponse(response)


@app.get("/mcp")
async def mcp_sse(request: Request):
    _check_mcp_auth(request)

    api_key = request.query_params.get("api_key", "")
    post_endpoint = "/mcp" + (f"?api_key={api_key}" if api_key else "")

    async def event_stream():
        yield f"event: endpoint\ndata: {post_endpoint}\n\n".encode("utf-8")
        try:
            while True:
                if await request.is_disconnected():
                    break
                await asyncio.sleep(15)
                yield b": keep-alive\n\n"
        except asyncio.CancelledError:
            return

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
