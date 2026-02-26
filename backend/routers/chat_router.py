from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Literal
import asyncio

chat_router = APIRouter()

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]

# for now this is dummy
async def fake_streaming_llm(messages):
    full_text = "I'm analyzing your finance graph. Here's what I found..."
    
    for word in full_text.split():
        yield word + " "
        await asyncio.sleep(0.05)

@chat_router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    # TODO: replace with real LLM call (OpenAI, Ollama, etc.)
    
    async def generator():
        async for chunk in fake_streaming_llm(req.messages):
            yield chunk

    return StreamingResponse(generator(), media_type="text/plain")