"""v2 chat agent — OpenRouter (OpenAI-compatible) with whitelisted tools only."""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import OpenAI

from app.config import settings
from app.models.filters import ChatRequest
from app.services.chat_tools import (
    DEEP_LINKS,
    TABLE_COLUMNS,
    TOOL_DEFINITIONS,
    execute_tool,
    tool_result_json,
)
from app.services.chatbot import SUGGESTED_PROMPTS, handle_chat

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the BHG ETL Operations assistant for Microsoft Fabric pipeline health.

Rules:
- Answer ONLY using data returned by your tools. Never invent run counts, site names, or error messages.
- BHG pipelines use Bronze (BR), Silver (SL), and Gold (GL) layers.
- SAMMS clinics are identified by SiteCode (e.g. AHK, B12B).

Tool Selection Guide:
- Failures & errors: get_failures, get_top_failing_pipelines, get_site_audit
- Overall health & KPIs: get_daily_kpis, get_daily_trends
- Site analysis: get_site_audit, get_site_counts (to see how many sites are processing)
- Data flow & throughput: get_rows_by_pipeline, get_rows_by_layer, get_rows_by_site, get_pipeline_layer_matrix
- Running tasks: get_running_tasks
- Pipeline runs: get_pipeline_runs
- Data quality: get_dq_issues

- Use start_date_from / start_date_to from context when the user says "today" or gives a date.
- If the user asks "how many sites", use get_site_counts.
- If the user asks about rows/throughput, use get_rows_by_pipeline, get_rows_by_layer, or get_rows_by_site.
- Be concise but helpful. Summarize key numbers in plain English with percentages and comparisons.
- If no tool can answer the question, say so and suggest what the user can ask.
"""


def _openrouter_client() -> OpenAI:
    return OpenAI(
        base_url=settings.openrouter_base_url,
        api_key=settings.openrouter_api_key,
    )


def _context_note(request: ChatRequest) -> str:
    parts: list[str] = []
    if request.start_date_from and request.start_date_to:
        parts.append(f"Date range: {request.start_date_from} to {request.start_date_to}")
    elif request.ref_date:
        parts.append(f"Reference date: {request.ref_date}")
    if request.lookback_days:
        parts.append(f"Default lookback days: {request.lookback_days}")
    return "Context: " + "; ".join(parts) if parts else ""


def _pick_table_payload(tool_results: list[dict[str, Any]]) -> tuple[list[str] | None, list[dict[str, Any]] | None]:
    for result in reversed(tool_results):
        tool = result.get("tool", "")
        if "rows" in result and result["rows"]:
            cols = TABLE_COLUMNS.get(tool)
            if cols:
                return cols, result["rows"]
            rows = result["rows"]
            return list(rows[0].keys()), rows
        if tool == "get_daily_kpis" and "data" in result:
            data = result["data"]
            return list(data.keys()), [data]
    return None, None


def handle_chat_agent(request: ChatRequest) -> dict[str, Any]:
    if not settings.openrouter_api_key:
        return handle_chat(request)

    client = _openrouter_client()
    context = _context_note(request)

    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if context:
        messages.append({"role": "system", "content": context})

    for item in request.history[-8:]:
        messages.append({"role": item.role, "content": item.content})

    messages.append({"role": "user", "content": request.question})

    tools_used: list[str] = []
    tool_results: list[dict[str, Any]] = []

    try:
        for _ in range(settings.openrouter_max_tool_rounds):
            response = client.chat.completions.create(
                model=settings.openrouter_model,
                messages=messages,
                tools=TOOL_DEFINITIONS,
                tool_choice="auto",
                extra_headers={
                    "HTTP-Referer": settings.openrouter_site_url,
                    "X-Title": settings.openrouter_app_title,
                },
            )

            choice = response.choices[0]
            assistant_message = choice.message

            if assistant_message.tool_calls:
                messages.append(
                    {
                        "role": "assistant",
                        "content": assistant_message.content or "",
                        "tool_calls": [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments,
                                },
                            }
                            for tc in assistant_message.tool_calls
                        ],
                    }
                )

                for tool_call in assistant_message.tool_calls:
                    fn_name = tool_call.function.name
                    try:
                        fn_args = json.loads(tool_call.function.arguments or "{}")
                    except json.JSONDecodeError:
                        fn_args = {}

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

                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": tool_result_json(result),
                        }
                    )
                continue

            summary = (assistant_message.content or "").strip()
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
        }

    except Exception as exc:
        logger.exception("OpenRouter agent failed")
        if "guardrail" in str(exc).lower() or "zdr violation" in str(exc).lower():
            return {
                "intent": "agent:guardrail_blocked",
                "summary": _format_agent_error(exc),
                "columns": None,
                "rows": None,
                "deepLink": None,
                "suggestedPrompts": SUGGESTED_PROMPTS,
                "toolsUsed": [],
                "chatMode": "agent_error",
            }
        fallback = handle_chat(request)
        fallback["summary"] = f"{fallback['summary']}\n\n({_format_agent_error(exc)} Showing rule-based answer.)"
        fallback["chatMode"] = "rules_fallback"
        return fallback


def _format_agent_error(exc: Exception) -> str:
    text = str(exc)
    if "guardrail" in text.lower() or "zdr violation" in text.lower():
        return (
            "OpenRouter blocked the configured model due to your account guardrails or "
            "Zero Data Retention (ZDR) privacy settings.\n\n"
            "Fix option A — allow DeepSeek:\n"
            "  1. https://openrouter.ai/workspaces/default/guardrails\n"
            "  2. Add deepseek to allowed providers OR remove DeepSeek from blocked models\n"
            "  3. Turn off enforce_zdr_other if you need non-ZDR providers\n\n"
            "Fix option B — use a ZDR-friendly model in .env:\n"
            "  OPENROUTER_MODEL=google/gemini-2.0-flash-001\n"
            "  or OPENROUTER_MODEL=openai/gpt-4o-mini\n\n"
            "Then restart the API."
        )
    return f"AI agent error: {exc}"


