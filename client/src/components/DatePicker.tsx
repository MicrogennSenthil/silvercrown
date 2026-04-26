import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const PRIMARY = "#027fa5";
const TONAL = "#d2f1fa";
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseYMD(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  "data-testid"?: string;
  className?: string;
}

export default function DatePicker({ value, onChange, label, min, max, placeholder = "Select date", "data-testid": testId, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const today = toLocalYMD(new Date());

  const selected = parseYMD(value);
  const initDisplay = selected || parseYMD(today)!;
  const [displayYear, setDisplayYear] = useState(initDisplay.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(initDisplay.getMonth());

  // Sync display month/year when value changes externally
  useEffect(() => {
    const d = parseYMD(value);
    if (d) { setDisplayYear(d.getFullYear()); setDisplayMonth(d.getMonth()); }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function prevMonth() {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
    else setDisplayMonth(m => m - 1);
  }
  function nextMonth() {
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1); }
    else setDisplayMonth(m => m + 1);
  }

  function selectDate(ymd: string) {
    onChange(ymd);
    setOpen(false);
  }

  // Build calendar grid
  const firstDay = new Date(displayYear, displayMonth, 1).getDay();
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function cellYMD(day: number) {
    return `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function isDisabled(ymd: string) {
    if (min && ymd < min) return true;
    if (max && ymd > max) return true;
    return false;
  }

  const displayValue = value ? (() => {
    const d = parseYMD(value);
    if (!d) return "";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  })() : "";

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
      {/* Floating label */}
      {label && (
        <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none pointer-events-none">
          {label}
        </label>
      )}

      {/* Input trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between border rounded px-3 py-2.5 text-sm text-left transition-all outline-none group ${open ? "border-[#027fa5] shadow-sm ring-1 ring-[#027fa5]/20" : "border-gray-300 hover:border-[#027fa5]/60"}`}
        data-testid={testId}
      >
        <span className={value ? "text-gray-800 font-medium" : "text-gray-400 text-sm"}>
          {displayValue || placeholder}
        </span>
        <Calendar
          size={15}
          className="flex-shrink-0 ml-2 transition-colors"
          style={{ color: open ? PRIMARY : "#9ca3af" }}
        />
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div
          className="absolute z-[100] mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{ minWidth: 280, animation: "fadeSlideIn 0.15s ease-out" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #0397c4 100%)` }}
          >
            <button
              type="button"
              onClick={prevMonth}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="text-center">
              <div className="text-white font-semibold text-sm tracking-wide">{MONTHS[displayMonth]}</div>
              <div className="text-white/70 text-xs">{displayYear}</div>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Today shortcut */}
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
            <div className="flex gap-1">
              {DAYS_SHORT.map(d => (
                <div key={d} className="w-9 text-center text-xs font-semibold text-gray-400">{d}</div>
              ))}
            </div>
          </div>

          {/* Day grid */}
          <div className="px-4 pb-3">
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const ymd = cellYMD(day);
                const isSelected = ymd === value;
                const isToday = ymd === today;
                const disabled = isDisabled(ymd);
                const isSun = (i % 7 === 0);
                const isSat = (i % 7 === 6);

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && selectDate(ymd)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium transition-all relative"
                    style={
                      isSelected
                        ? { background: PRIMARY, color: "white", boxShadow: `0 2px 8px ${PRIMARY}55` }
                        : isToday
                        ? { background: TONAL, color: PRIMARY, fontWeight: 700 }
                        : disabled
                        ? { color: "#d1d5db", cursor: "not-allowed" }
                        : isSun || isSat
                        ? { color: "#94a3b8" }
                        : { color: "#374151" }
                    }
                    onMouseEnter={e => {
                      if (!disabled && !isSelected) (e.currentTarget as HTMLElement).style.background = TONAL;
                    }}
                    onMouseLeave={e => {
                      if (!disabled && !isSelected && !isToday) (e.currentTarget as HTMLElement).style.background = "";
                      else if (isToday && !isSelected) (e.currentTarget as HTMLElement).style.background = TONAL;
                    }}
                  >
                    {day}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: PRIMARY }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  if (!isDisabled(today)) {
                    selectDate(today);
                    setDisplayYear(new Date().getFullYear());
                    setDisplayMonth(new Date().getMonth());
                  }
                }}
                className="text-xs font-semibold transition-colors px-2 py-1 rounded"
                style={{ color: PRIMARY }}
                disabled={isDisabled(today)}
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => { onChange(""); setOpen(false); }}
                  className="text-xs font-medium text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
