from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Any, Dict
import uuid

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    provider: Literal["anthropic", "openai"]
    model: Optional[str] = None     # override default model per provider
    graph_context: Optional[Dict[str, Any]] = None  # selected node, current graph state etc
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))