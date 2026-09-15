import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api, FALLBACK_CHAT_PROMPTS } from "../api/client";
import { DataTable } from "../components/DataTable";
import type { ChatRequestBody, ChatResponse } from "../types";
import type { FilterContext } from "../hooks/useFilterContext";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  response?: ChatResponse;
}

export function ChatPage() {
  const { filters } = useOutletContext<FilterContext>();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const { data: prompts, isError: promptsError } = useQuery({
    queryKey: ["chatPrompts"],
    queryFn: api.chatPrompts,
    retry: 1,
  });
  const { data: chatConfig, isError: configError } = useQuery({
    queryKey: ["chatConfig"],
    queryFn: api.chatConfig,
    retry: 1,
  });

  const suggestedPrompts = prompts?.prompts?.length ? prompts.prompts : FALLBACK_CHAT_PROMPTS;
  const apiDown = promptsError && configError;

  const buildRequest = (question: string): ChatRequestBody => {
    const body: ChatRequestBody = {
      question,
      startDateFrom: filters.startDateFrom,
      startDateTo: filters.startDateTo,
      history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    };
    if (filters.refDate) body.refDate = filters.refDate;
    // lookbackDays only used when no date range is set (legacy v1 window)
    if (!filters.startDateFrom && !filters.startDateTo) {
      body.lookbackDays = filters.lookbackDays ?? 7;
    }
    return body;
  };

  const mutation = useMutation({
    mutationFn: (question: string) => api.chat(buildRequest(question)),
    onSuccess: (response, question) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: response.summary, response },
      ]);
    },
  });

  const send = (question: string) => {
    if (!question.trim() || mutation.isPending) return;
    mutation.mutate(question.trim());
    setInput("");
  };

  const isAgent = chatConfig?.mode === "agent";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="border-b border-slate-800 px-4 py-2 text-xs text-slate-500">
          {apiDown ? (
            <span className="text-amber-300">API unavailable — start backend on port 8000</span>
          ) : isAgent ? (
            <>
              AI agent mode
              {chatConfig?.provider && <span className="text-slate-400"> ({chatConfig.provider})</span>}
              {chatConfig?.model && <span className="text-slate-400"> — {chatConfig.model}</span>}
            </>
          ) : (
            <>Rule-based mode — set GEMINI_API_KEY in tools/etl-ops-api/.env and restart API</>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4" style={{ minHeight: 400 }}>
          {messages.length === 0 && (
            <p className="text-sm text-slate-400">
              {isAgent
                ? "Ask anything about ETL health, failures, sites, or data quality."
                : "Ask about ETL health, or use a suggested prompt on the right."}
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "text-right" : "text-left"}>
              <div
                className={
                  msg.role === "user"
                    ? "inline-block rounded-xl bg-sky-600/30 px-4 py-2 text-sm"
                    : "inline-block max-w-full rounded-xl bg-slate-800 px-4 py-2 text-sm text-left whitespace-pre-wrap"
                }
              >
                {msg.content}
                {msg.response && showDebug && (
                  <p className="mt-1 text-xs text-slate-500">
                    {msg.response.chatMode ?? "rules"} · {msg.response.intent}
                    {msg.response.toolsUsed?.length ? ` · tools: ${msg.response.toolsUsed.join(", ")}` : ""}
                  </p>
                )}
                {msg.response?.rows && msg.response.rows.length > 0 && msg.response.columns && (
                  <div className="mt-3 text-left">
                    <DataTable
                      rows={msg.response.rows as Record<string, string>[]}
                      columns={msg.response.columns.map((c) => ({ key: c, label: c }))}
                    />
                  </div>
                )}
                {msg.response?.deepLink && (
                  <Link to={msg.response.deepLink} className="mt-2 block text-xs text-sky-400 hover:underline">
                    View in dashboard →
                  </Link>
                )}
              </div>
            </div>
          ))}
          {mutation.isPending && <p className="text-sm text-slate-400">Thinking…</p>}
          {mutation.isError && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {(mutation.error as Error).message}
            </div>
          )}
        </div>

        <form
          className="flex gap-2 border-t border-slate-800 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isAgent ? "Ask anything about ETL ops…" : "Ask a question…"}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-50"
          >
            Send
          </button>
        </form>

        <label className="flex items-center gap-2 border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
          <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
          Show agent debug (intent / tools)
        </label>
      </div>

      <aside className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Suggested prompts</h3>
        {promptsError && (
          <p className="text-[10px] text-amber-400/90">Using offline prompts (API not reachable)</p>
        )}
        <div className="flex flex-col gap-2">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => send(prompt)}
              disabled={mutation.isPending}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs text-slate-300 hover:border-sky-600 hover:text-white disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
