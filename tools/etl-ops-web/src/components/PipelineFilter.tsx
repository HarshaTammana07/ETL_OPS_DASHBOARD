import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { api } from "../api/client";

interface PipelineFilterProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function PipelineFilter({ value, onChange }: PipelineFilterProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  useEffect(() => {
    setInput(value ?? "");
  }, [value]);

  // Fetch all config names once (cached in React Query)
  const { data: configNames } = useQuery({
    queryKey: ["configNamesAll"],
    queryFn: () => api.configNames(),
    staleTime: 60_000,
  });

  const allPipelines = useMemo(() => {
    return (configNames?.items ?? []).filter((name) => Boolean(name && name.trim()));
  }, [configNames?.items]);

  // If the user has typed something different from the currently active value,
  // filter by what they typed. Otherwise, show all pipelines so the user can browse or switch.
  const isTypingSearch = input.trim() !== "" && input.trim().toLowerCase() !== (value ?? "").trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!isTypingSearch) {
      return allPipelines;
    }
    const q = input.trim().toLowerCase();
    return allPipelines.filter((name) => name.toLowerCase().includes(q));
  }, [allPipelines, input, isTypingSearch]);

  const showList = open;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setHighlight(-1);
        // Reset input to current selected value when clicking away without picking
        setInput(value ?? "");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [value]);

  const apply = (next: string) => {
    const trimmed = next.trim();
    setInput(trimmed);
    onChange(trimmed || undefined);
    setOpen(false);
    setHighlight(-1);
  };

  const clear = () => {
    setInput("");
    onChange(undefined);
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.focus();
  };

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      setHighlight(-1);
      setInput(value ?? "");
    } else {
      setOpen(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  const onInputChange = (next: string) => {
    setInput(next);
    if (!open) setOpen(true);
    setHighlight(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlight(0);
        return;
      }
      // highlight -1 represents "All pipelines" at top
      setHighlight((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((i) => Math.max(i - 1, -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (highlight === -1) {
        apply("");
      } else if (highlight >= 0 && suggestions[highlight]) {
        apply(suggestions[highlight]);
      } else if (suggestions.length === 1) {
        apply(suggestions[0]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
      setInput(value ?? "");
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-[220px]">
      <input
        ref={inputRef}
        id={listId}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${listId}-listbox`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="All pipelines"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => {
          setOpen(true);
          inputRef.current?.select();
        }}
        onClick={() => {
          if (!open) {
            setOpen(true);
            inputRef.current?.select();
          }
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pl-2.5 pr-14 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
      />

      {/* Action buttons: Clear ('✕') and Dropdown Chevron ('▼') */}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {(Boolean(value) || Boolean(input)) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            title="Clear pipeline filter (X)"
            aria-label="Clear pipeline filter"
            tabIndex={-1}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleOpen();
          }}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title={open ? "Close dropdown" : "Show all pipelines"}
          aria-label={open ? "Close dropdown" : "Show all pipelines"}
          tabIndex={-1}
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {showList && (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 min-w-[260px] overflow-y-auto rounded-md border border-slate-700 bg-slate-950 py-1 shadow-2xl"
        >
          {/* Always offer 'All pipelines' option to quickly reset */}
          <li
            role="option"
            aria-selected={!value}
            className={`flex items-center justify-between cursor-pointer px-3 py-1.5 text-sm transition-colors ${
              highlight === -1
                ? "bg-slate-800 text-sky-400 font-medium"
                : !value
                  ? "bg-sky-500/10 text-sky-400 font-medium"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply("")}
            onMouseEnter={() => setHighlight(-1)}
          >
            <span>All pipelines</span>
            {!value && <span className="text-xs text-sky-400 font-bold">✓</span>}
          </li>

          {suggestions.length === 0 ? (
            <li className="px-3 py-3 text-center text-xs text-slate-500 italic">
              No pipelines matching "{input}"
            </li>
          ) : (
            suggestions.map((name, index) => {
              const isSelected = value === name;
              const isHighlighted = highlight === index;
              return (
                <li
                  key={name}
                  role="option"
                  aria-selected={isSelected}
                  className={`flex items-center justify-between cursor-pointer px-3 py-1.5 text-sm transition-colors ${
                    isHighlighted
                      ? "bg-slate-800 text-slate-100"
                      : isSelected
                        ? "bg-sky-500/10 text-sky-300 font-medium"
                        : "text-slate-200 hover:bg-slate-800/70 hover:text-slate-100"
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => apply(name)}
                  onMouseEnter={() => setHighlight(index)}
                >
                  <span className="truncate pr-2">{name}</span>
                  {isSelected && <span className="text-xs text-sky-400 font-bold shrink-0">✓</span>}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
