from fastapi import APIRouter, Header, Request, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
import json
from agent.graph import build_agent, AgentState
from models.chat import ChatRequest
from db.db import engine
from sqlalchemy import text as sql_text

chat_router = APIRouter()

@chat_router.post("/chat/stream")
# async def chat_stream(req: ChatRequest, api_key: str = Header(None, alias="X-API-Key")):
async def chat_stream(req: ChatRequest, request: Request):

    # --- read key from header, not request body ---
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    # basic sanity checks — don't log the key itself, ever
    if not api_key.startswith(("sk-ant-", "sk-")):
        raise HTTPException(status_code=401, detail="Invalid API key format")

    async def generator():
        try:
            agent = build_agent(req.provider, api_key, req.model)

            # thread_id is the session — LangGraph checkpointer stores full history per thread
            # including ToolMessages, so Anthropic always gets a valid message sequence
            config = {"configurable": {"thread_id": req.session_id}}

            # only receive the new user message — checkpointer handles the rest
            user_content = req.message.content
            if req.graph_context:
                ctx = req.graph_context.copy()
                if "filters" in ctx and "report_id" in ctx["filters"]:
                    with engine.connect() as conn:
                        r = conn.execute(sql_text("SELECT name FROM reports WHERE id = :id"), {"id": ctx["filters"]["report_id"]})
                        row = r.fetchone()
                        if row:
                            ctx["filters"]["report_name"] = row[0]
                user_content += f"\n\n[Graph context: {json.dumps(ctx)}]"

            new_message_state: AgentState = {
                "messages": [HumanMessage(content=user_content)],
                "provider": req.provider,
                "api_key": api_key,
                "model": req.model
            }

            # stream events from the graph
            async for event in agent.astream_events(new_message_state, config=config, version="v2"):
                kind = event["event"]

                # --- stream text tokens to frontend ---
                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    text = chunk.text()
                    if text:
                        # plain text delta
                        yield f"data: {json.dumps({'type': 'text_delta', 'text': text})}\n\n"

                # --- tool call started ---
                elif kind == "on_tool_start":
                    tool_name = event["name"]
                    tool_input = event["data"].get("input", {})
                    yield f"data: {json.dumps({'type': 'tool_calling', 'name': tool_name, 'input': tool_input, 'run_id': event['run_id']})}\n\n"

                # --- tool call finished ---
                elif kind == "on_tool_end":
                    tool_message = event["data"]["output"]  # always a ToolMessage
                    try:
                        tool_output = json.loads(tool_message.content)
                    except (json.JSONDecodeError, TypeError):
                        tool_output = {}

                    # check if this is a UI tool event
                    if isinstance(tool_output, dict) and tool_output.get("__ui_event__"):
                        yield f"data: {json.dumps({'type': 'ui_event', 'run_id': event['run_id'], 'payload': tool_output})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'tool_result', 'run_id': event['run_id'], 'result': tool_output})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            # sanitize error — never echo back anything that might contain the key
            err_str = str(e)
            if "api_key" in err_str.lower() or "sk-" in err_str:
                err_str = "Authentication error — check your API key"
            yield f"data: {json.dumps({'type': 'error', 'message': err_str})}\n\n"

    return StreamingResponse(generator(), media_type="text/event-stream")
