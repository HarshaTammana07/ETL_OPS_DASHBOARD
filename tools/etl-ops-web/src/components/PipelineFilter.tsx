import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
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

  const { data: configNames } = useQuery({
    queryKey: ["configNames", input, open],
    queryFn: () => api.configNames(input.trim() || undefined),
    enabled: open,
  });

  const suggestions = configNames?.items ?? [];
  const showList = open && (suggestions.length > 0 || !input.trim());

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const apply = (next: string) => {
    const trimmed = next.trim();
    setInput(trimmed);
    onChange(trimmed || undefined);
    setOpen(false);
    setHighlight(-1);
  };

  const onInputChange = (next: string) => {
    setInput(next);
    onChange(next.trim() || undefined);
    setOpen(true);
    setHighlight(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const options = suggestions;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && highlight >= 0 && options[highlight]) {
      event.preventDefault();
      apply(options[highlight]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-[200px]">
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
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500"
      >
        ▼
      </span>

      {showList && (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 py-1 shadow-lg"
        >
          {!input.trim() && (
            <li
              role="option"
              aria-selected={!value}
              className="cursor-pointer px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply("")}
            >
              All pipelines
            </li>
          )}
          {suggestions.map((name, index) => (
            <li
              key={name}
              role="option"
              aria-selected={value === name}
              className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-slate-800 hover:text-slate-100 ${
                highlight === index ? "bg-slate-800 text-slate-100" : "text-slate-200"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(name)}
              onMouseEnter={() => setHighlight(index)}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
