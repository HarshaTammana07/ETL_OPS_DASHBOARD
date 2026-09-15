"""v2 chat agent — Google Gemini API with whitelisted tools only."""

from __future__ import annotations

import json
import logging
from typing import Any

from google import genai
from google.genai import types

from app.config import settings
from app.models.filters import ChatRequest
from app.services.chat_tools import (
    DEEP_LINKS,
    TOOL_DEFINITIONS,
    execute_tool,
)
from app.services.chatbot import SUGGESTED_PROMPTS, handle_chat
from app.services.chatbot_agent import SYSTEM_PROMPT, _context_note, _format_agent_error, _pick_table_payload

logger = logging.getLogger(__name__)

GEMINI_MODEL_FALLBACKS = ("gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash-lite")


def _gemini_tools() -> list[types.Tool]:
    declarations: list[types.FunctionDeclaration] = []
    for tool in TOOL_DEFINITIONS:
        fn = tool["function"]
        declarations.append(
            types.FunctionDeclaration(
                name=fn["name"],
                description=fn["description"],
                parameters=fn["parameters"],
            )
        )
    return [types.Tool(function_declarations=declarations)]


def _build_contents(request: ChatRequest) -> list[types.Content]:
    contents: list[types.Content] = []
    system = SYSTEM_PROMPT
    context = _context_note(request)
    if context:
        system = f"{SYSTEM_PROMPT}\n\n{context}"

    contents.append(types.Content(role="user", parts=[types.Part(text=f"[System instructions]\n{system}")]))
    contents.append(types.Content(role="model", parts=[types.Part(text="Understood. I will only use tool data for BHG ETL answers.")]))

    for item in request.history[-8:]:
        role = "user" if item.role == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=item.content)]))

    contents.append(types.Content(role="user", parts=[types.Part(text=request.question)]))
    return contents


def _models_to_try() -> list[str]:
    ordered = [settings.gemini_model, *GEMINI_MODEL_FALLBACKS]
    seen: set[str] = set()
    out: list[str] = []
    for name in ordered:
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def _generate(client: genai.Client, model: str, contents: list[types.Content], tools: list[types.Tool]):
    return client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(tools=tools),
    )


def handle_chat_gemini(request: ChatRequest) -> dict[str, Any]:
    if not settings.gemini_api_key:
        return handle_chat(request)

    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options={"timeout": 60_000},
    )
    contents = _build_contents(request)
    tools = _gemini_tools()
    tools_used: list[str] = []
    tool_results: list[dict[str, Any]] = []
    active_model = settings.gemini_model

    try:
        for _ in range(settings.gemini_max_tool_rounds):
            last_error: Exception | None = None
            response = None
            for model in _models_to_try():
                try:
                    response = _generate(client, model, contents, tools)
                    active_model = model
                    break
                except Exception as exc:
                    last_error = exc
                    if "404" not in str(exc) and "NOT_FOUND" not in str(exc):
                        raise
            if response is None:
                raise last_error or RuntimeError("No Gemini model available")

            if not response.candidates:
                break

            candidate = response.candidates[0]
            if not candidate.content or not candidate.content.parts:
                break

            parts = candidate.content.parts
            function_calls = [part for part in parts if part.function_call]

            if function_calls:
                contents.append(candidate.content)
                response_parts: list[types.Part] = []

                for part in function_calls:
                    fc = part.function_call
                    if not fc or not fc.name:
                        continue
                    fn_name = fc.name
                    fn_args = dict(fc.args) if fc.args else {}

                    tools_used.append(fn_name)
                    result = execute_tool(
                        fn_name,
                        fn_args,
                        ref_date=request.ref_date,
                        lookback_days=request.lookback_days,
                        start_date_from=request.start_date_from,
                        start_date_to=request.start_date_to,
                    )
                    tool_results.append(result)
                    response_parts.append(
                        types.Part.from_function_response(
                            name=fn_name,
                            response={"result": json.loads(json.dumps(result, default=str))},
                        )
                    )

                contents.append(types.Content(role="user", parts=response_parts))
                continue

            summary = "".join(part.text or "" for part in parts).strip()
            if not summary:
                summary = "I couldn't generate an answer. Try rephrasing or use a suggested prompt."

            columns, rows = _pick_table_payload(tool_results)
            deep_link = DEEP_LINKS.get(tools_used[-1]) if tools_used else None

            return {
                "intent": "agent:" + ",".join(tools_used) if tools_used else "agent",
                "summary": summary,
                "columns": columns,
                "rows": rows,
                "deepLink": deep_link,
                "suggestedPrompts": SUGGESTED_PROMPTS,
                "toolsUsed": tools_used,
                "chatMode": "agent",
                "provider": "gemini",
                "model": active_model,
            }

        return {
            "intent": "agent:max_rounds",
            "summary": "I needed too many data lookups for one question. Try a simpler question or break it into parts.",
            "columns": None,
            "rows": None,
            "deepLink": None,
            "suggestedPrompts": SUGGESTED_PROMPTS,
            "toolsUsed": tools_used,
            "chatMode": "agent",
            "provider": "gemini",
            "model": active_model,
        }

    except Exception as exc:
        logger.exception("Gemini agent failed")
        msg = str(exc)
        if "404" in msg and "no longer available" in msg.lower():
            err = (
                "Gemini model not found. Set GEMINI_MODEL=gemini-3.6-flash in .env and restart the API."
            )
        else:
            err = _format_agent_error(exc)
        fallback = handle_chat(request)
        fallback["summary"] = f"{fallback['summary']}\n\n({err} Showing rule-based answer.)"
        fallback["chatMode"] = "rules_fallback"
        return fallback
