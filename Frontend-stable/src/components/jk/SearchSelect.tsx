import { useState, useRef, useEffect, type KeyboardEvent } from "react";

interface Option {
  value: string;
  label: string;
}

interface SearchSelectProps {
  options: Option[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
}

export function SearchSelect({
  options,
  value,
  onChange,
  multiple,
  placeholder,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    setHighlightIdx(0);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[highlightIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx, open]);

  function isSelected(val: string) {
    if (multiple) return (value as string[]).includes(val);
    return value === val;
  }

  function handleSelect(val: string) {
    if (multiple) {
      const arr = value as string[];
      const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
      onChange(next);
    } else {
      onChange(val);
      setOpen(false);
      setSearch("");
    }
  }

  function removeChip(val: string) {
    if (!multiple) return;
    onChange((value as string[]).filter((v) => v !== val));
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightIdx]) handleSelect(filtered[highlightIdx].value);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setSearch("");
        break;
    }
  }

  // Single-select trigger
  const singleLabel =
    !multiple && value
      ? (options.find((o) => o.value === value)?.label ?? placeholder ?? "Pilih...")
      : null;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      {multiple ? (
        <div
          onClick={() => setOpen(true)}
          className="min-h-[36px] w-full flex flex-wrap gap-1 items-center px-2 py-1 border border-[#E2E8F0] rounded-lg bg-white cursor-text focus-within:ring-2 focus-within:ring-[#1A4F8A]/20"
        >
          {(value as string[]).map((v) => {
            const label = options.find((o) => o.value === v)?.label ?? v;
            return (
              <span
                key={v}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EEF3FA] text-[11px] font-semibold text-[#476788]"
              >
                {label}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChip(v);
                  }}
                  className="hover:text-[#E11D48] leading-none"
                >
                  ×
                </button>
              </span>
            );
          })}
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={!open && (value as string[]).length === 0 ? placeholder || "Cari..." : ""}
            className="flex-1 min-w-[60px] outline-none bg-transparent text-[13px] placeholder-[#94A3B8]"
            style={{ width: search ? `${Math.max(search.length, 1)}ch` : "60px" }}
          />
        </div>
      ) : (
        <div
          onClick={() => setOpen(true)}
          className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg bg-white flex items-center gap-2 cursor-pointer focus-within:ring-2 focus-within:ring-[#1A4F8A]/20"
        >
          {open ? (
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik untuk mencari..."
              className="flex-1 outline-none bg-transparent text-[13px] placeholder-[#94A3B8]"
            />
          ) : (
            <span
              className={`flex-1 text-[13px] ${singleLabel ? "text-[#0F172A]" : "text-[#94A3B8]"}`}
            >
              {singleLabel || placeholder || "Pilih..."}
            </span>
          )}
          <svg
            className="w-4 h-4 text-[#94A3B8] shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-[#E2E8F0] rounded-lg shadow-lg max-h-48 overflow-y-auto"
        >
          {filtered.map((opt, idx) => {
            const selected = isSelected(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-[13px] transition-colors ${
                  idx === highlightIdx ? "bg-[#EEF3FA]" : "hover:bg-[#F8FAFC]"
                } ${selected ? "font-semibold text-[#1e40af]" : "text-[#0F172A]"}`}
              >
                {multiple && (
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      selected ? "bg-[#1e40af] border-[#1e40af]" : "border-[#CBD5E1]"
                    }`}
                  >
                    {selected && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </span>
                )}
                {opt.label}
              </div>
            );
          })}
        </div>
      )}

      {open && filtered.length === 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-[#E2E8F0] rounded-lg shadow-lg p-3 text-[13px] text-[#94A3B8] text-center">
          Tidak ditemukan
        </div>
      )}
    </div>
  );
}
