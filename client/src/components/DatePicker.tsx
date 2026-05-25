import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar, ChevronDown } from "lucide-react";

const PRIMARY = "#027fa5";
const TONAL = "#d2f1fa";
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
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
  openUp?: boolean;
  "data-testid"?: string;
  className?: string;
}

type Mode = "day" | "month" | "year";

// Popup dimensions (approximate, used for flip logic)
const POPUP_W = 288;
const POPUP_H = 350;

export default function DatePicker({ value, onChange, label, min, max, placeholder = "Select date", openUp = false, "data-testid": testId, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("day");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const today = toLocalYMD(new Date());

  const selected = parseYMD(value);
  const initDisplay = selected || parseYMD(today)!;
  const [displayYear, setDisplayYear] = useState(initDisplay.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(initDisplay.getMonth());
  const [yearBase, setYearBase] = useState(Math.floor(initDisplay.getFullYear() / 12) * 12);

  // Fixed position of the popup
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const calcPopupPos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: align left edge with trigger, clamp to viewport
    let left = r.left;
    if (left + POPUP_W > vw - 8) left = Math.max(8, vw - POPUP_W - 8);

    // Vertical: openUp forces upward; otherwise prefer direction with more space
    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    let top: number;
    let transformOrigin: string;
    const goUp = openUp ? spaceAbove >= 80 : spaceAbove > spaceBelow && spaceAbove >= POPUP_H;
    if (goUp) {
      top = r.top - POPUP_H - 4;
      transformOrigin = "bottom left";
    } else {
      top = r.bottom + 4;
      transformOrigin = "top left";
    }

    setPopupStyle({ position: "fixed", top, left, width: POPUP_W, transformOrigin, zIndex: 9999 });
  }, [openUp]);

  useEffect(() => {
    const d = parseYMD(value);
    if (d) {
      setDisplayYear(d.getFullYear());
      setDisplayMonth(d.getMonth());
      setYearBase(Math.floor(d.getFullYear() / 12) * 12);
    }
  }, [value]);

  useEffect(() => {
    if (!open) { setMode("day"); return; }
    calcPopupPos();

    function onMouseDown(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !popupRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        setMode("day");
      }
    }
    function onScroll() { calcPopupPos(); }
    function onResize() { calcPopupPos(); }

    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, calcPopupPos]);

  // ── Day mode helpers ────────────────────────────────────────────────────────
  function prevMonth() {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
    else setDisplayMonth(m => m - 1);
  }
  function nextMonth() {
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1); }
    else setDisplayMonth(m => m + 1);
  }

  function selectDate(ymd: string) { onChange(ymd); setOpen(false); setMode("day"); }

  function isDisabled(ymd: string) {
    if (min && ymd < min) return true;
    if (max && ymd > max) return true;
    return false;
  }

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

  // ── Display value ───────────────────────────────────────────────────────────
  const displayValue = value ? (() => {
    const d = parseYMD(value);
    if (!d) return "";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  })() : "";

  // ── Year grid (12 years per page) ───────────────────────────────────────────
  const yearList = Array.from({ length: 12 }, (_, i) => yearBase + i);

  const popup = open ? (
    <div
      ref={popupRef}
      style={{ ...popupStyle, fontFamily: "'Source Sans Pro', sans-serif", animation: "datePickerFadeIn 0.14s ease-out" }}
      className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
    >
      {/* ── HEADER ── */}
      <div
        className="flex items-center justify-between px-3 py-3"
        style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #0397c4 100%)` }}
      >
        <button
          type="button"
          onClick={() => {
            if (mode === "day") prevMonth();
            else if (mode === "month") setDisplayYear(y => y - 1);
            else setYearBase(b => b - 12);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all flex-shrink-0"
        >
          <ChevronLeft size={15} />
        </button>

        <button
          type="button"
          onClick={() => setMode(m => m === "day" ? "year" : "day")}
          className="flex-1 text-center group flex items-center justify-center gap-1 hover:bg-white/10 rounded-lg py-1 transition-all"
        >
          {mode === "year" ? (
            <span className="text-white font-semibold text-sm">{yearList[0]} – {yearList[11]}</span>
          ) : mode === "month" ? (
            <span className="text-white font-semibold text-sm">{displayYear}</span>
          ) : (
            <>
              <div>
                <div className="text-white font-semibold text-sm leading-none">{MONTHS[displayMonth]}</div>
                <div className="text-white/75 text-xs mt-0.5">{displayYear}</div>
              </div>
              <ChevronDown size={13} className="text-white/60 group-hover:text-white transition-colors mt-0.5" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            if (mode === "day") nextMonth();
            else if (mode === "month") setDisplayYear(y => y + 1);
            else setYearBase(b => b + 12);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all flex-shrink-0"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* ── YEAR PICKER ── */}
      {mode === "year" && (
        <div className="p-3">
          <div className="grid grid-cols-4 gap-1.5">
            {yearList.map(yr => {
              const isCurrent = yr === new Date().getFullYear();
              const isSelected = yr === displayYear;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => { setDisplayYear(yr); setMode("day"); }}
                  className="h-9 rounded-lg text-xs font-semibold transition-all"
                  style={
                    isSelected
                      ? { background: PRIMARY, color: "white", boxShadow: `0 2px 8px ${PRIMARY}44` }
                      : isCurrent
                      ? { background: TONAL, color: PRIMARY }
                      : { color: "#374151" }
                  }
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = TONAL; }}
                  onMouseLeave={e => { if (!isSelected && !isCurrent) (e.currentTarget as HTMLElement).style.background = ""; else if (isCurrent && !isSelected) (e.currentTarget as HTMLElement).style.background = TONAL; }}
                >
                  {yr}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MONTH PICKER ── */}
      {mode === "month" && (
        <div className="p-3">
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS_SHORT.map((mon, mi) => {
              const isCurrent = mi === new Date().getMonth() && displayYear === new Date().getFullYear();
              const isSelected = mi === displayMonth;
              return (
                <button
                  key={mon}
                  type="button"
                  onClick={() => { setDisplayMonth(mi); setMode("day"); }}
                  className="h-9 rounded-lg text-xs font-semibold transition-all"
                  style={
                    isSelected
                      ? { background: PRIMARY, color: "white" }
                      : isCurrent
                      ? { background: TONAL, color: PRIMARY }
                      : { color: "#374151" }
                  }
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = TONAL; }}
                  onMouseLeave={e => { if (!isSelected && !isCurrent) (e.currentTarget as HTMLElement).style.background = ""; else if (isCurrent && !isSelected) (e.currentTarget as HTMLElement).style.background = TONAL; }}
                >
                  {mon}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DAY GRID ── */}
      {mode === "day" && (
        <>
          <div className="flex px-4 pt-2.5 pb-1">
            {DAYS_SHORT.map(d => (
              <div key={d} className="w-9 text-center text-xs font-semibold text-gray-400">{d}</div>
            ))}
          </div>
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
                    onMouseEnter={e => { if (!disabled && !isSelected) (e.currentTarget as HTMLElement).style.background = TONAL; }}
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

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  if (!isDisabled(today)) {
                    selectDate(today);
                    const n = new Date();
                    setDisplayYear(n.getFullYear());
                    setDisplayMonth(n.getMonth());
                  }
                }}
                className="text-xs font-semibold px-2 py-1 rounded transition-colors"
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
        </>
      )}

      <style>{`
        @keyframes datePickerFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`} style={{ fontFamily: "'Source Sans Pro', sans-serif" }}>
      {label && (
        <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none pointer-events-none">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between border rounded px-3 py-2.5 text-sm text-left transition-all outline-none ${open ? "border-[#027fa5] shadow-sm ring-1 ring-[#027fa5]/20" : "border-gray-300 hover:border-[#027fa5]/60"}`}
        data-testid={testId}
      >
        <span className={value ? "text-gray-800 font-medium" : "text-gray-400 text-sm"}>
          {displayValue || placeholder}
        </span>
        <Calendar size={15} className="flex-shrink-0 ml-2 transition-colors" style={{ color: open ? PRIMARY : "#9ca3af" }} />
      </button>

      {/* Portal: renders at document.body, escapes all overflow:hidden ancestors */}
      {typeof document !== "undefined" && createPortal(popup, document.body)}
    </div>
  );
}
