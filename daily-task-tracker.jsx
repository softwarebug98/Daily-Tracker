import { useState, useEffect } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80", "#60a5fa", "#a78bfa", "#f472b6"];

function formatDate(d) { return d.toISOString().split("T")[0]; }
function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function todayStr() { return formatDate(new Date()); }
function dateLabel(str) {
  const today = todayStr(), tomorrow = formatDate(new Date(Date.now() + 86400000));
  if (str === today) return "Today";
  if (str === tomorrow) return "Tomorrow";
  return parseDate(str).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function ls(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }

// ── Cup SVG (size-aware) ─────────────────────────────────────
function Cup({ filled, onClick, ml, pct }) {
  // pct = partial fill 0–1 for the last cup
  const big = ml === 500;
  const w = big ? 46 : 36, h = big ? 54 : 44;
  const fillY = big ? (pct != null ? 12 + (1 - pct) * 28 : 12) : (pct != null ? 16 + (1 - pct) * 22 : 16);
  const color = filled || pct != null ? "#38bdf8" : "#2a2a3a";
  const bg = filled || pct != null ? "#1a3a5c" : "#1a1a24";
  return (
    <div onClick={onClick} title={`+${ml}ml`} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, userSelect: "none", transition: "transform 0.12s" }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.13)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
      <svg width={w} height={h} viewBox="0 0 36 46" fill="none">
        <path d="M6 8 L4 42 Q4 44 6 44 L30 44 Q32 44 32 42 L30 8 Z" fill={bg} stroke={color} strokeWidth="1.5" />
        {(filled || pct != null) && (
          <path d={`M${6 + (fillY - 8) * 0.05} ${fillY} L${4 + (42 - fillY) * 0.02} 42 Q4.5 43 6.5 43 L29.5 43 Q31.5 43 31.5 42 L${30 - (42 - fillY) * 0.02} ${fillY} Z`}
            fill="#38bdf8" opacity="0.75" />
        )}
        <rect x="5" y="6" width="26" height="4" rx="2" fill={color} opacity="0.9" />
        {(filled || pct != null) && <line x1="11" y1={fillY + 6} x2="11" y2="40" stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />}
      </svg>
      <span style={{ fontSize: 9, color: filled || pct != null ? "#38bdf8" : "#444", letterSpacing: "0.04em" }}>{ml}ml</span>
    </div>
  );
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [tasks, setTasks] = useState(() => ls("tt_tasks", {}));
  const [recurring, setRecurring] = useState(() => ls("tt_recurring", []));
  const [completions, setCompletions] = useState(() => ls("tt_completions", {}));

  // hydration: { "2024-01-01": 1400 }  — stored in ml
  const [hydration, setHydration] = useState(() => ls("tt_hydration", {}));
  const [goalMl, setGoalMl] = useState(() => ls("tt_goal_ml", 2000));
  const [cupSize, setCupSize] = useState(() => ls("tt_cup_size", 200)); // 200 or 500
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [goalInput, setGoalInput] = useState("2000");

  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [taskColor, setTaskColor] = useState(COLORS[4]);
  const [taskDate, setTaskDate] = useState(todayStr());
  const [recurringInput, setRecurringInput] = useState("");
  const [recurringType, setRecurringType] = useState("daily");
  const [recurringDays, setRecurringDays] = useState([]);
  const [recurringColor, setRecurringColor] = useState(COLORS[2]);
  const [activeTab, setActiveTab] = useState("day");
  const [editingRecurring, setEditingRecurring] = useState(null);

  useEffect(() => { localStorage.setItem("tt_tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem("tt_recurring", JSON.stringify(recurring)); }, [recurring]);
  useEffect(() => { localStorage.setItem("tt_completions", JSON.stringify(completions)); }, [completions]);
  useEffect(() => { localStorage.setItem("tt_hydration", JSON.stringify(hydration)); }, [hydration]);
  useEffect(() => { localStorage.setItem("tt_goal_ml", JSON.stringify(goalMl)); }, [goalMl]);
  useEffect(() => { localStorage.setItem("tt_cup_size", JSON.stringify(cupSize)); }, [cupSize]);

  // ── tasks helpers ───────────────────────────────────────────
  const dayOfWeek = parseDate(selectedDate).getDay();
  const recurringForDay = recurring.filter(r => r.type === "daily" || (r.type === "weekly" && r.days.includes(dayOfWeek)));
  const tasksForDay = tasks[selectedDate] || [];
  const toggleCompletion = (id, date) => { const k = `${id}_${date}`; setCompletions(c => ({ ...c, [k]: !c[k] })); };
  const isComplete = (id, date) => !!completions[`${id}_${date}`];
  const totalForDay = recurringForDay.length + tasksForDay.length;
  const doneForDay = recurringForDay.filter(r => isComplete(r.id, selectedDate)).length + tasksForDay.filter(t => isComplete(t.id, selectedDate)).length;
  const progress = totalForDay ? Math.round((doneForDay / totalForDay) * 100) : 0;
  const navDate = (dir) => { const d = parseDate(selectedDate); d.setDate(d.getDate() + dir); setSelectedDate(formatDate(d)); };

  // ── Inject Al Baqarah recurring tasks once on mount ─────────
  useEffect(() => {
    const key = 'tt_baqarah_recurring_injected';
    if (localStorage.getItem(key)) return;
    const prayers = [
      { prayer: 'Fajr',    pages: '1–10',  color: '#facc15' },
      { prayer: 'Dhuhr',   pages: '11–20', color: '#4ade80' },
      { prayer: 'Asr',     pages: '21–30', color: '#60a5fa' },
      { prayer: 'Maghrib', pages: '31–40', color: '#a78bfa' },
      { prayer: 'Isha',    pages: '41–49', color: '#f472b6' },
    ];
    const newRecurring = prayers.map((p, i) => ({
      id: `baqarah_r_${i}`,
      title: `📖 Al Baqarah · ${p.pages} · After ${p.prayer}`,
      color: p.color,
      type: 'daily',
      days: [],
    }));
    setRecurring(prev => [...prev, ...newRecurring]);
    localStorage.setItem(key, '1');
  }, []);

  const addTask = () => {
    if (!taskInput.trim()) return;
    setTasks(p => ({ ...p, [taskDate]: [...(p[taskDate] || []), { id: `t_${Date.now()}`, title: taskInput.trim(), color: taskColor }] }));
    setTaskInput(""); setTaskDate(todayStr()); setTaskColor(COLORS[4]); setShowAddTask(false);
  };
  const deleteTask = (date, id) => setTasks(p => ({ ...p, [date]: (p[date] || []).filter(t => t.id !== id) }));

  const addRecurring = () => {
    if (!recurringInput.trim() || (recurringType === "weekly" && recurringDays.length === 0)) return;
    const newR = { id: `r_${Date.now()}`, title: recurringInput.trim(), type: recurringType, days: recurringDays, color: recurringColor };
    if (editingRecurring) { setRecurring(p => p.map(r => r.id === editingRecurring ? { ...newR, id: editingRecurring } : r)); setEditingRecurring(null); }
    else setRecurring(p => [...p, newR]);
    setRecurringInput(""); setRecurringType("daily"); setRecurringDays([]); setRecurringColor(COLORS[2]); setShowAddRecurring(false);
  };
  const deleteRecurring = (id) => setRecurring(p => p.filter(r => r.id !== id));
  const startEditRecurring = (r) => { setEditingRecurring(r.id); setRecurringInput(r.title); setRecurringType(r.type); setRecurringDays(r.days || []); setRecurringColor(r.color); setShowAddRecurring(true); };
  const toggleDay = (d) => setRecurringDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

  // ── hydration helpers ────────────────────────────────────────
  const mlToday = hydration[selectedDate] || 0;
  const hydPct = Math.min(100, Math.round((mlToday / goalMl) * 100));
  const addMl = (ml) => setHydration(h => ({ ...h, [selectedDate]: Math.min(goalMl + cupSize * 4, (h[selectedDate] || 0) + ml) }));
  const removeMl = (ml) => setHydration(h => ({ ...h, [selectedDate]: Math.max(0, (h[selectedDate] || 0) - ml) }));

  // Build cup array for grid: how many full cups + optional partial
  const numFull = Math.floor(mlToday / cupSize);
  const remainder = mlToday % cupSize;
  const totalCups = Math.max(Math.ceil(goalMl / cupSize), numFull + (remainder > 0 ? 1 : 0));

  const tabs = [{ id: "day", label: "📅  DAY" }, { id: "hydration", label: "💧  WATER" }, { id: "recurring", label: "🔁  RECURRING" }];
  const inp = { width: "100%", background: "#1a1a24", border: "1px solid #2a2a3a", borderRadius: 8, padding: "10px 12px", color: "#e8e8f0", fontFamily: "'DM Mono',monospace", fontSize: 13, outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f14", color: "#e8e8f0", fontFamily: "'DM Mono','Courier New',monospace", display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@400;600;700&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#1a1a24} ::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
        .tr{transition:background .15s;border-radius:8px} .tr:hover{background:rgba(255,255,255,.04)}
        .tr:hover .db{opacity:1}
        .db{opacity:0;transition:opacity .15s;background:none;border:none;cursor:pointer;color:#f87171;font-size:14px;padding:2px 6px}
        .cb{width:20px;height:20px;border-radius:6px;border:2px solid;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s}
        .cd{width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .12s,border-color .12s}
        .cd:hover{transform:scale(1.2)}
        .dc{cursor:pointer;border:1.5px solid;border-radius:6px;padding:3px 9px;font-size:11px;transition:all .12s;user-select:none}
        .dn{cursor:pointer;border:none;background:none;color:#888;font-size:18px;padding:4px 10px;transition:color .15s}
        .dn:hover{color:#e8e8f0}
        .ab{cursor:pointer;border:none;font-family:inherit;transition:all .15s}
        .ab:hover{filter:brightness(1.1);transform:translateY(-1px)}
        .tb{transition:all .2s;cursor:pointer;border:none;background:none}
        .mo{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:center;justify-content:center}
        .pill{border-radius:999px;padding:2px 10px;font-size:11px;font-weight:500;letter-spacing:.04em}
        .sz{cursor:pointer;border:1.5px solid;border-radius:10px;padding:10px 18px;transition:all .15s;font-family:inherit;font-size:13px;font-weight:600}
        .sz:hover{transform:scale(1.04)}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1) opacity(.4);cursor:pointer}
      `}</style>

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 540, padding: "28px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, letterSpacing: "-0.02em" }}>DAILY TRACKER</span>
          <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", marginTop: 4 }}>◆</span>
        </div>
        <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.08em", marginBottom: 24 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()}
        </div>
        <div style={{ display: "flex", background: "#1a1a24", borderRadius: 10, padding: 3, marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.id} className="tb" onClick={() => setActiveTab(t.id)} style={{
              flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 11, letterSpacing: "0.05em",
              fontFamily: "'DM Mono',monospace", fontWeight: 500,
              background: activeTab === t.id ? "#24243a" : "none",
              color: activeTab === t.id ? "#e8e8f0" : "#555",
              borderBottom: activeTab === t.id ? `2px solid ${t.id === "hydration" ? "#38bdf8" : "#6366f1"}` : "2px solid transparent",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 540, padding: "0 20px" }}>

        {/* ══ DAY ══ */}
        {activeTab === "day" && (<>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button className="dn" onClick={() => navDate(-1)}>‹</button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 500, fontFamily: "'Space Grotesk',sans-serif" }}>{dateLabel(selectedDate)}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{FULL_DAYS[parseDate(selectedDate).getDay()]}</div>
            </div>
            <button className="dn" onClick={() => navDate(1)}>›</button>
          </div>

          {/* Quick date chips */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto", paddingBottom: 2 }}>
            {[
              { label: "Yesterday", offset: -1 },
              { label: "Today",     offset: 0  },
              { label: "Tomorrow",  offset: 1  },
              { label: "In 2 days", offset: 2  },
              { label: "In 3 days", offset: 3  },
              { label: "Next week", offset: 7  },
            ].map(({ label, offset }) => {
              const d = new Date(); d.setDate(d.getDate() + offset);
              const val = formatDate(d);
              const active = val === selectedDate;
              return (
                <button key={label} onClick={() => setSelectedDate(val)} style={{
                  flexShrink: 0, padding: "5px 12px", borderRadius: 999, border: "1.5px solid",
                  borderColor: active ? "#6366f1" : "#2a2a3a",
                  background: active ? "#6366f122" : "#1a1a24",
                  color: active ? "#a78bfa" : "#555",
                  fontFamily: "'DM Mono',monospace", fontSize: 11, cursor: "pointer",
                  whiteSpace: "nowrap", transition: "all 0.15s",
                }}>{label}</button>
              );
            })}
          </div>

          {totalForDay > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666", marginBottom: 6, letterSpacing: "0.05em" }}>
                <span>{doneForDay}/{totalForDay} COMPLETE</span><span>{progress}%</span>
              </div>
              <div style={{ height: 4, background: "#1e1e2e", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#6366f1,#a78bfa)", borderRadius: 99, transition: "width 0.4s" }} />
              </div>
            </div>
          )}

          {recurringForDay.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", marginBottom: 8 }}>RECURRING</div>
              {recurringForDay.map(r => {
                const done = isComplete(r.id, selectedDate);
                return (
                  <div key={r.id} className="tr" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", marginBottom: 4 }}>
                    <div className="cb" onClick={() => toggleCompletion(r.id, selectedDate)} style={{ borderColor: r.color, background: done ? r.color : "transparent" }}>
                      {done && <span style={{ color: "#0f0f14", fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, textDecoration: done ? "line-through" : "none", color: done ? "#555" : "#ccc", transition: "all 0.2s" }}>{r.title}</span>
                    <span className="pill" style={{ background: r.color + "22", color: r.color }}>{r.type === "daily" ? "daily" : r.days.map(d => DAYS[d]).join(" ")}</span>
                  </div>
                );
              })}
            </div>
          )}

          {tasksForDay.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", marginBottom: 8 }}>SCHEDULED</div>
              {tasksForDay.map(t => {
                const done = isComplete(t.id, selectedDate);
                return (
                  <div key={t.id} className="tr" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", marginBottom: 4 }}>
                    <div className="cb" onClick={() => toggleCompletion(t.id, selectedDate)} style={{ borderColor: t.color, background: done ? t.color : "transparent" }}>
                      {done && <span style={{ color: "#0f0f14", fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, textDecoration: done ? "line-through" : "none", color: done ? "#555" : "#ccc", transition: "all 0.2s" }}>{t.title}</span>
                    <button className="db" onClick={() => deleteTask(selectedDate, t.id)}>✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {recurringForDay.length === 0 && tasksForDay.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#444", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>○</div>No tasks for this day
            </div>
          )}
          <button className="ab" onClick={() => { setTaskDate(selectedDate); setShowAddTask(true); }}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: "#1a1a24", color: "#888", fontSize: 12, letterSpacing: "0.06em", fontFamily: "'DM Mono',monospace", border: "1.5px dashed #2a2a3a", marginTop: 8 }}>
            + ADD TASK
          </button>
        </>)}

        {/* ══ HYDRATION ══ */}
        {activeTab === "hydration" && (<>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button className="dn" onClick={() => navDate(-1)}>‹</button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 500, fontFamily: "'Space Grotesk',sans-serif" }}>{dateLabel(selectedDate)}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{FULL_DAYS[parseDate(selectedDate).getDay()]}</div>
            </div>
            <button className="dn" onClick={() => navDate(1)}>›</button>
          </div>

          {/* Status card */}
          <div style={{ background: "#0d1f35", borderRadius: 20, padding: "24px 20px 20px", marginBottom: 20, border: "1px solid #1e3a5f", textAlign: "center" }}>
            {/* Arc */}
            <div style={{ position: "relative", width: 160, height: 92, margin: "0 auto 16px" }}>
              <svg width="160" height="92" viewBox="0 0 160 92">
                <path d="M 12 87 A 68 68 0 0 1 148 87" fill="none" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
                <path d="M 12 87 A 68 68 0 0 1 148 87" fill="none" stroke="url(#wg)" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${(hydPct / 100) * 213.6} 213.6`} style={{ transition: "stroke-dasharray 0.5s ease" }} />
                <defs><linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#0ea5e9" /><stop offset="100%" stopColor="#38bdf8" /></linearGradient></defs>
              </svg>
              <div style={{ position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", color: hydPct >= 100 ? "#38bdf8" : "#e8e8f0", lineHeight: 1 }}>{hydPct}%</div>
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", color: "#38bdf8", marginBottom: 4 }}>
              {mlToday} <span style={{ fontSize: 14, color: "#4a7fa0", fontWeight: 400 }}>/ {goalMl} ml</span>
            </div>
            <div style={{ fontSize: 12, color: "#4a7fa0" }}>{Math.max(0, goalMl - mlToday)} ml remaining</div>
            {hydPct >= 100 && <div style={{ marginTop: 12, fontSize: 12, color: "#38bdf8", background: "#0c3a5a", borderRadius: 8, padding: "6px 14px", display: "inline-block" }}>🎉 Goal reached!</div>}
          </div>

          {/* Cup size selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", marginBottom: 12 }}>CUP SIZE</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[200, 500].map(sz => (
                <button key={sz} className="sz" onClick={() => setCupSize(sz)} style={{
                  flex: 1, background: cupSize === sz ? "#0c3a5a" : "#1a1a24",
                  color: cupSize === sz ? "#38bdf8" : "#666",
                  borderColor: cupSize === sz ? "#38bdf8" : "#2a2a3a",
                }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{sz === 200 ? "🥤" : "🍶"}</div>
                  <div style={{ fontSize: 13 }}>{sz} ml</div>
                  <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>{sz === 200 ? "small cup" : "large bottle"}</div>
                </button>
              ))}
            </div>
          </div>

          {/* +/- controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 24, background: "#111827", borderRadius: 16, padding: "16px 0", border: "1px solid #1e293b" }}>
            <button className="ab" onClick={() => removeMl(cupSize)} style={{ width: 46, height: 46, borderRadius: 10, background: "#1f1225", color: "#f87171", border: "1px solid #3f1f2f", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <div style={{ textAlign: "center", minWidth: 100 }}>
              <div style={{ fontSize: 13, color: "#4a7fa0", marginBottom: 2, letterSpacing: "0.06em" }}>TAP TO ADD</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", color: "#38bdf8" }}>+{cupSize} ml</div>
            </div>
            <button className="ab" onClick={() => addMl(cupSize)} style={{ width: 46, height: 46, borderRadius: 10, background: "#0c3a5a", color: "#38bdf8", border: "1px solid #1e5a8a", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          </div>

          {/* Cup grid */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", marginBottom: 14 }}>
              YOUR CUPS TODAY · {numFull}{remainder > 0 ? "+" : ""} of {Math.ceil(goalMl / cupSize)}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
              {Array.from({ length: totalCups }).map((_, i) => {
                const filled = i < numFull;
                const partial = !filled && i === numFull && remainder > 0 ? remainder / cupSize : null;
                return (
                  <Cup key={i} ml={cupSize} filled={filled} pct={partial}
                    onClick={() => {
                      if (filled) removeMl(cupSize);
                      else addMl(cupSize);
                    }} />
                );
              })}
            </div>
          </div>

          {/* Goal edit */}
          <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.08em" }}>DAILY GOAL</span>
              <button onClick={() => { setGoalInput(String(goalMl)); setShowGoalEdit(v => !v); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#38bdf8", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                {showGoalEdit ? "✕ cancel" : "✎ edit"}
              </button>
            </div>
            {showGoalEdit ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="number" min="200" max="10000" step="100" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                  style={{ flex: 1, background: "#1a1a24", border: "1px solid #38bdf855", borderRadius: 8, padding: "8px 12px", color: "#38bdf8", fontFamily: "'DM Mono',monospace", fontSize: 14, outline: "none" }} />
                <span style={{ fontSize: 12, color: "#555" }}>ml</span>
                <button className="ab" onClick={() => { setGoalMl(Math.max(200, Math.min(10000, parseInt(goalInput) || 2000))); setShowGoalEdit(false); }}
                  style={{ padding: "8px 14px", borderRadius: 8, background: "#0c3a5a", color: "#38bdf8", border: "1px solid #38bdf855", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
                  Save
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: "#38bdf8" }}>{goalMl} ml / day</div>
            )}
          </div>
        </>)}

        {/* ══ RECURRING ══ */}
        {activeTab === "recurring" && (<>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", marginBottom: 12 }}>ALL RECURRING TASKS</div>
          {recurring.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#444", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔁</div>No recurring tasks yet
            </div>
          )}
          {recurring.map(r => (
            <div key={r.id} className="tr" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 8px", marginBottom: 4 }}>
              <div style={{ width: 4, height: 32, borderRadius: 99, background: r.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#ccc" }}>{r.title}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{r.type === "daily" ? "Every day" : `Weekly: ${(r.days || []).map(d => DAYS[d]).join(", ")}`}</div>
              </div>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", fontSize: 13, padding: "2px 6px" }} onClick={() => startEditRecurring(r)}>✎</button>
              <button className="db" style={{ opacity: 1 }} onClick={() => deleteRecurring(r.id)}>✕</button>
            </div>
          ))}
          <button className="ab" onClick={() => { setEditingRecurring(null); setRecurringInput(""); setRecurringType("daily"); setRecurringDays([]); setRecurringColor(COLORS[2]); setShowAddRecurring(true); }}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: "#1a1a24", color: "#888", fontSize: 12, letterSpacing: "0.06em", fontFamily: "'DM Mono',monospace", border: "1.5px dashed #2a2a3a", marginTop: 8 }}>
            + ADD RECURRING TASK
          </button>
        </>)}
      </div>

      {/* ══ Add Task Modal ══ */}
      {showAddTask && (
        <div className="mo" onClick={() => setShowAddTask(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#16161f", borderRadius: 16, padding: 28, width: "90%", maxWidth: 420, border: "1px solid #2a2a3a" }}>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif", marginBottom: 20 }}>Add Task</div>
            <input value={taskInput} onChange={e => setTaskInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Task name..." autoFocus style={{ ...inp, marginBottom: 16 }} />
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 8, letterSpacing: "0.06em" }}>DATE</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                {[{label:"Today",offset:0},{label:"Tomorrow",offset:1},{label:"+2 days",offset:2},{label:"Next week",offset:7}].map(({label,offset}) => {
                  const d2 = new Date(); d2.setDate(d2.getDate() + offset); const val = formatDate(d2);
                  return <button key={label} onClick={() => setTaskDate(val)} style={{ padding:"4px 10px", borderRadius:6, border:"1.5px solid", borderColor: taskDate===val ? "#6366f1" : "#2a2a3a", background: taskDate===val ? "#6366f122" : "#1a1a24", color: taskDate===val ? "#a78bfa" : "#666", fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer" }}>{label}</button>;
                })}
              </div>
              <input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)} style={{ ...inp, padding: "8px 12px" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 8, letterSpacing: "0.06em" }}>COLOR</div>
              <div style={{ display: "flex", gap: 8 }}>{COLORS.map(c => <div key={c} className="cd" onClick={() => setTaskColor(c)} style={{ background: c, borderColor: taskColor === c ? "#fff" : "transparent" }} />)}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowAddTask(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "#1a1a24", color: "#888", border: "1px solid #2a2a3a", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>Cancel</button>
              <button className="ab" onClick={addTask} style={{ flex: 2, padding: "10px", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600 }}>Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Add Recurring Modal ══ */}
      {showAddRecurring && (
        <div className="mo" onClick={() => setShowAddRecurring(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#16161f", borderRadius: 16, padding: 28, width: "90%", maxWidth: 420, border: "1px solid #2a2a3a" }}>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif", marginBottom: 20 }}>{editingRecurring ? "Edit" : "Add"} Recurring Task</div>
            <input value={recurringInput} onChange={e => setRecurringInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addRecurring()} placeholder="Task name..." autoFocus style={{ ...inp, marginBottom: 16 }} />
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 8, letterSpacing: "0.06em" }}>FREQUENCY</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["daily", "weekly"].map(t => (
                  <button key={t} onClick={() => setRecurringType(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1.5px solid", borderColor: recurringType === t ? "#6366f1" : "#2a2a3a", background: recurringType === t ? "#6366f122" : "#1a1a24", color: recurringType === t ? "#a78bfa" : "#888", fontFamily: "'DM Mono',monospace", fontSize: 12, cursor: "pointer" }}>{t}</button>
                ))}
              </div>
            </div>
            {recurringType === "weekly" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 8, letterSpacing: "0.06em" }}>DAYS</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {DAYS.map((d, i) => (
                    <div key={i} className="dc" onClick={() => toggleDay(i)}
                      style={{ borderColor: recurringDays.includes(i) ? "#6366f1" : "#2a2a3a", background: recurringDays.includes(i) ? "#6366f122" : "transparent", color: recurringDays.includes(i) ? "#a78bfa" : "#666" }}>
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 8, letterSpacing: "0.06em" }}>COLOR</div>
              <div style={{ display: "flex", gap: 8 }}>{COLORS.map(c => <div key={c} className="cd" onClick={() => setRecurringColor(c)} style={{ background: c, borderColor: recurringColor === c ? "#fff" : "transparent" }} />)}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowAddRecurring(false); setEditingRecurring(null); }} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "#1a1a24", color: "#888", border: "1px solid #2a2a3a", cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>Cancel</button>
              <button className="ab" onClick={addRecurring} style={{ flex: 2, padding: "10px", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600 }}>{editingRecurring ? "Save" : "Add"} Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
