from fastapi import APIRouter

from app.config import settings
from app.models.filters import ChatRequest
from app.services.chatbot import SUGGESTED_PROMPTS, handle_chat
from app.services.chatbot_agent import handle_chat_agent
from app.services.chatbot_gemini import handle_chat_gemini

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _agent_handler():
    if settings.chat_mode != "agent":
        return None
    if settings.chat_provider == "gemini" and settings.gemini_api_key:
        return handle_chat_gemini
    if settings.chat_provider == "openrouter" and settings.openrouter_api_key:
        return handle_chat_agent
    if settings.gemini_api_key:
        return handle_chat_gemini
    if settings.openrouter_api_key:
        return handle_chat_agent
    return None


@router.get("/prompts")
def prompts():
    return {"prompts": SUGGESTED_PROMPTS}


@router.get("/config")
def chat_config():
    handler = _agent_handler()
    if handler is handle_chat_gemini:
        return {"mode": "agent", "provider": "gemini", "model": settings.gemini_model}
    if handler is handle_chat_agent:
        return {"mode": "agent", "provider": "openrouter", "model": settings.openrouter_model}
    return {"mode": "rules", "provider": None, "model": None}


@router.post("")
def chat(request: ChatRequest):
    handler = _agent_handler()
    if handler:
        return handler(request)
    return handle_chat(request)
