import React, { useState, useRef, useEffect } from "react";
import ContributionMap from "./ContributionMap.jsx";
import TimerCircle from "./TimerCircle.jsx";
import soundFocus from "./ding.mp3";
import soundBreak from "./ding-break.mp3";

const COLORS = {
  bg: "#161925",
  surface: "#23263a",
  accent: "#8edfff",
  accentSoft: "#aee7ff",
  accentFade: "#e4f7ff",
  focus: "#4adc89",
  break: "#ffd66e",
  longBreak: "#ff7cb9",
  text: "#e0e6f0",
  textSoft: "#a7b2cc",
  border: "#2e3147",
  shadow: "0 4px 16px 0 rgba(54,90,255,0.08)",
  button: "#24305e",
  buttonActive: "#8edfff",
  tabActive: "#2c3254",
  danger: "#ff4b5c",
};

const DEFAULT_DURATIONS = {
  focus: 25 * 60,
  break: 5 * 60,
  longBreak: 15 * 60,
};

const MODES = [
  { key: "focus", label: "Focus", color: COLORS.focus },
  { key: "break", label: "Break", color: COLORS.break },
  { key: "longBreak", label: "Long Break", color: COLORS.longBreak },
];

const API_URL= "https://script.google.com/macros/s/AKfycbxRLznvfGO_bMX1sMymAbS96Mye-Qd2j7QiBf7CcOGK-tE1M7L7qN4iYXpDks02l-NqlA/exec";
async function fetchFromAPI(key) {
  const res = await fetch(`${API_URL}?action=${key}`);
  const text = await res.text();
  try {
    console.log(text);
    return JSON.parse(text);
  } catch {
    return null;
  }
}
async function syncToAPI(action, key, value) {
  const res = await fetch(`${API_URL}?action=${action}&key=${key}&value=${value}`);
  const text = await res.text();
  try {
    console.log(text);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const STORAGE_KEY_DUR = "pomo-durations";
const STORAGE_KEY_HIST = "pomo-history";
const STORAGE_KEY_UI = "pomo-ui"; // NEW: For tab, mode, running, timeLeft, focusCount, lastTimeStamp

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getTodayDhaka() {
  const now = new Date();
  const tzOffset = 6 * 60 * 60 * 1000;
  const nowDhaka = new Date(now.getTime() + tzOffset);
  return nowDhaka.toISOString().slice(0, 10);
}

function getNextMode(mode, focusCount) {
  if (mode === "focus") {
    return focusCount % 4 === 0 ? "longBreak" : "break";
  }
  return "focus";
}

// --- UI state helpers ---
function saveUIState({ tab, mode, running, timeLeft, focusCount, lastTimeStamp }) {
  localStorage.setItem(
    STORAGE_KEY_UI,
    JSON.stringify({ tab, mode, running, timeLeft, focusCount, lastTimeStamp })
  );
}
function loadUIState() {
  const stored = localStorage.getItem(STORAGE_KEY_UI);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

// --- MAIN COMPONENT ---
function App() {
  // --- Load persisted UI state or fallback ---
  const ui = loadUIState();
  const [tab, setTab] = useState(ui?.tab || "pomo");
  const [mode, setMode] = useState(ui?.mode || "focus");
  const [focusCount, setFocusCount] = useState(ui?.focusCount ?? 1);
  const [durations, setDurations] = useState(() => {
    const localDur = localStorage.getItem(STORAGE_KEY_DUR);
    return localDur ? JSON.parse(localDur) : { ...DEFAULT_DURATIONS };
  });
  const [running, setRunning] = useState(ui?.running || false);
  const [timeLeft, setTimeLeft] = useState(() => {
    // Time calculation on reload
    if (!ui) return DEFAULT_DURATIONS.focus;
    if (!ui.lastTimeStamp) return ui.timeLeft ?? DEFAULT_DURATIONS.focus;
    // If running, subtract elapsed time, else just return stored timeLeft
    const now = Date.now();
    if (ui.running) {
      const elapsed = Math.floor((now - ui.lastTimeStamp) / 1000);
      const t = Math.max(0, (ui.timeLeft ?? DEFAULT_DURATIONS[ui.mode || "focus"]) - elapsed);
      return t;
    }
    return ui.timeLeft ?? DEFAULT_DURATIONS[ui.mode || "focus"];
  });

  const [history, setHistory] = useState(() => {
    const stored = localStorage.getItem("pomo-history");
    return stored ? JSON.parse(stored) : {};
  });

  const [loading, setLoading] = useState(false);

  const timerRef = useRef();
  const audioFocusRef = useRef();
  const audioBreakRef = useRef();

  // Persist UI state on every relevant change
  useEffect(() => {
    saveUIState({
      tab,
      mode,
      running,
      timeLeft,
      focusCount,
      lastTimeStamp: running ? Date.now() : null, // only update if running
    });
    // eslint-disable-next-line
  }, [tab, mode, running, timeLeft, focusCount]);

  // Update document title
  useEffect(() => {
    document.title = `${formatTime(timeLeft)} - ${MODES.find(m => m.key === mode).label}`;
  }, [timeLeft, mode]);

  // Timer effect
  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t > 1) return t - 1;
        clearInterval(timerRef.current);
        handleFinish();
        return 0;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line
  }, [running]);
useEffect(() => {
  if (Notification && Notification.permission === "default") {
    Notification.requestPermission();
  }
}, []);
  // On mount, resync if timer has already elapsed on reload
  useEffect(() => {
    const ui = loadUIState();
    if (ui && ui.running && ui.lastTimeStamp && ui.timeLeft != null) {
      const now = Date.now();
      const elapsed = Math.floor((now - ui.lastTimeStamp) / 1000);
      if (elapsed >= ui.timeLeft) {
        // Timer should have finished, run handleFinish logic
        handleFinish(true);
      }
    }
    // Fetch durations/history from API after ui state ready, but always show local first
    setLoading(true);
    fetchFromAPI("getAllDurations").then(apiDur => {
      if (apiDur && typeof apiDur === "object") {
        setDurations(apiDur);
        localStorage.setItem(STORAGE_KEY_DUR, JSON.stringify(apiDur));
        if (mode in apiDur && timeLeft > apiDur[mode]) {
          setTimeLeft(apiDur[mode]);
        }
      }
    }).finally(() => setLoading(false));
    fetchFromAPI("getHistory").then(apiHist => {
      if (apiHist && typeof apiHist === "object") {
        setHistory(apiHist);
        localStorage.setItem(STORAGE_KEY_HIST, JSON.stringify(apiHist));
      }
    });
    // eslint-disable-next-line
  }, []);

  // Core logic for finishing a timer session
  function handleFinish(isAuto = false) {
    // isAuto = true means fired from refresh where timer elapsed
    if (mode === "break" || mode === "longBreak") {
      audioBreakRef.current?.play();
    } else {
      audioFocusRef.current?.play();
    }
    // === NEW: Show notification ===
  if (Notification && Notification.permission === "granted") {
    let notifTitle = mode === "focus" ? "Focus session complete!" : "Break time's up!";
    let notifBody = mode === "focus"
      ? "Time for a break or a long break."
      : "Time to get back to focus!";
    new Notification(notifTitle, { body: notifBody });
  }
  // === END NEW ===
    const nextMode = getNextMode(mode, focusCount);
    const nextFocusCount = mode === "focus" ? focusCount + 1 : focusCount;
    const today = getTodayDhaka();
    const add = Math.round(durations[mode] / 60);

    setHistory(prev => {
      
      const newVal = add;
      const updated = { ...prev, [today]: newVal };
      localStorage.setItem(STORAGE_KEY_HIST, JSON.stringify(updated));
      syncToAPI("incrementHistory", today, newVal).catch(console.error);
      return updated;
    });

    setTimeout(() => {
      setMode(nextMode);
      setTimeLeft(durations[nextMode]);
      setFocusCount(nextFocusCount);
      setRunning(false);
      saveUIState({
        tab,
        mode: nextMode,
        running: false,
        timeLeft: durations[nextMode],
        focusCount: nextFocusCount,
        lastTimeStamp: null,
      });
    }, isAuto ? 0 : 500);
  }

  function handleStartPause() {
    setRunning(r => {
      // Save timestamp if starting, clear if pausing
      saveUIState({
        tab,
        mode,
        running: !r,
        timeLeft,
        focusCount,
        lastTimeStamp: !r ? Date.now() : null,
      });
      return !r;
    });
  }

  function handleReset() {
    setRunning(false);
    setTimeLeft(durations[mode]);
    saveUIState({
      tab,
      mode,
      running: false,
      timeLeft: durations[mode],
      focusCount,
      lastTimeStamp: null,
    });
  }

  function handleModeChange(newMode) {
    setRunning(false);
    setMode(newMode);
    setTimeLeft(durations[newMode]);
    if (newMode === "focus") setFocusCount(1);
    saveUIState({
      tab,
      mode: newMode,
      running: false,
      timeLeft: durations[newMode],
      focusCount: newMode === "focus" ? 1 : focusCount,
      lastTimeStamp: null,
    });
  }

  function handleTabChange(newTab) {
    setTab(newTab);
    saveUIState({
      tab: newTab,
      mode,
      running,
      timeLeft,
      focusCount,
      lastTimeStamp: running ? Date.now() : null,
    });
  }

  function handleDurationChange(type, val) {
    let valSec = Math.max(1, Number(val)) * 60;
    setDurations(d => {
      const upd = { ...d, [type]: valSec };
      if (mode === type) setTimeLeft(valSec);
      localStorage.setItem(STORAGE_KEY_DUR, JSON.stringify(upd));
      syncToAPI("updateDuration", type, valSec).catch(console.error);
      return upd;
    });
    // If changing current mode duration, update timeLeft and persist
    if (mode === type) {
      setTimeLeft(valSec);
      saveUIState({
        tab,
        mode,
        running,
        timeLeft: valSec,
        focusCount,
        lastTimeStamp: running ? Date.now() : null,
      });
    }
  }

  const [timerWidth, setTimerWidth] = useState(230);
  const timerRefDiv = useRef();
  useEffect(() => {
    function updateSize() {
      if (timerRefDiv.current) {
        const w = Math.max(180, Math.min(360, timerRefDiv.current.offsetWidth * 0.9));
        setTimerWidth(w);
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const premiumShadow = "0 4px 24px 0 rgba(142,223,255,0.18), 0 2px 8px 0 rgba(36,48,94,0.18)";
  const modeObj = MODES.find(m => m.key === mode);
  const total = durations[mode];
  const percentGone = 1 - timeLeft / total;

  return (
    <div style={{
      fontFamily: "Inter,system-ui,sans-serif",
      maxWidth: 480,
      minHeight: "100vh",
      margin: "0 auto",
      background: COLORS.bg,
      color: COLORS.text,
      padding: 0,
      overflow: "hidden"
    }}>
      {/* Fixed Top Bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          maxWidth: 480,
          background: COLORS.surface,
          zIndex: 100,
          boxShadow: COLORS.shadow,
          borderBottom: `2px solid ${COLORS.border}`,
          margin: "0 auto"
        }}
      >
        <h1 style={{
          margin: 0,
          padding: "22px 32px 10px 32px",
          fontSize: 28,
          letterSpacing: "-1px",
          fontWeight: 800,
          background: `linear-gradient(90deg, ${COLORS.accentSoft} 0%, ${COLORS.focus} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>Pomodoro</h1>
        {/* Main Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 0,
            borderBottom: `2px solid ${COLORS.border}`,
            paddingLeft: 32,
            background: COLORS.surface
          }}
        >
          <button
            onClick={() => handleTabChange("pomo")}
            style={{
              padding: "12px 32px",
              border: "none",
              background: tab === "pomo" ? COLORS.tabActive : "transparent",
              color: tab === "pomo" ? COLORS.accent : COLORS.textSoft,
              fontWeight: 700,
              fontSize: 17,
              borderRadius: "12px 12px 0 0",
              cursor: "pointer",
              boxShadow: tab === "pomo" ? premiumShadow : "none",
              transition: "all 0.18s"
            }}
          >
            Pomodoro
          </button>
          <button
            onClick={() => handleTabChange("history")}
            style={{
              padding: "12px 32px",
              border: "none",
              background: tab === "history" ? COLORS.tabActive : "transparent",
              color: tab === "history" ? COLORS.accent : COLORS.textSoft,
              fontWeight: 700,
              fontSize: 17,
              borderRadius: "12px 12px 0 0",
              cursor: "pointer",
              boxShadow: tab === "history" ? premiumShadow : "none",
              transition: "all 0.18s"
            }}
          >
            History
          </button>
        </div>
      </div>

      {/* Main Content, add top padding to account for fixed bar height */}
      <div style={{ padding: "120px 28px 32px 28px" }}>
        { tab === "pomo" ? (
          <div ref={timerRefDiv}>
            <div style={{ display: "flex", gap: 12, marginBottom: 24, justifyContent: "center" }}>
              {MODES.map(m => (
                <button
                  key={m.key}
                  style={{
                    background: mode === m.key ? m.color : COLORS.button,
                    color: mode === m.key ? COLORS.bg : COLORS.textSoft,
                    fontWeight: mode === m.key ? 900 : 600,
                    border: "none",
                    padding: "12px 24px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 17,
                    letterSpacing: 1,
                    boxShadow: mode === m.key ? premiumShadow : "none",
                    transition: "all 0.15s"
                  }}
                  onClick={() => handleModeChange(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {/* Timer with Circle */}
            <div style={{ display: "flex", justifyContent: "center", margin: "5px 0 10px 0", width: "100%" }}>
              <TimerCircle
                size={timerWidth}
                stroke={Math.max(10, timerWidth * 0.08)}
                percent={percentGone}
                mainColor={modeObj.color}
                bgColor={COLORS.bg}
              >
                <div style={{
                  fontSize: Math.max(36, timerWidth * 0.24),
                  fontWeight: 900,
                  color: modeObj.color,
                  textShadow: "0 6px 24px rgba(142,223,255,0.16)"
                }}>
                  {formatTime(timeLeft)}
                </div>
              </TimerCircle>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 14 }}>
              <button
                onClick={handleStartPause}
                style={{
                  background: running ? COLORS.danger : COLORS.accent,
                  color: COLORS.bg,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 42px",
                  fontSize: 19,
                  boxShadow: premiumShadow,
                  cursor: "pointer",
                  transition: "background 0.18s"
                }}
              >
                {running ? "Pause" : "Start"}
              </button>
              <button
                onClick={handleReset}
                style={{
                  background: COLORS.button,
                  color: COLORS.text,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 24px",
                  fontSize: 17,
                  boxShadow: "none",
                  cursor: "pointer",
                  transition: "background 0.18s"
                }}
              >
                Reset
              </button>
            </div>
            <div style={{
              margin: "16px 0 32px 0",
              color: COLORS.textSoft,
              fontWeight: 500,
              textAlign: "center"
            }}>
              <span style={{
                background: COLORS.surface,
                borderRadius: 6,
                padding: "6px 16px",
                display: "inline-block",
                fontWeight: 800,
                color: COLORS.textSoft,
                letterSpacing: 0.7
              }}>
                Session: <span style={{
                  color: COLORS.accent,
                  fontWeight: 900
                }}>{mode === "focus" ? focusCount : "-"}</span>
              </span>
            </div>
            {/* Audio for focus and break */}
            <audio ref={audioFocusRef} src={soundFocus} preload="auto" />
            <audio ref={audioBreakRef} src={soundBreak} preload="auto" />
            <div style={{
              margin: "28px 0 0 0",
              background: COLORS.surface,
              borderRadius: 16,
              padding: "22px 18px 12px 18px",
              boxShadow: COLORS.shadow,
              border: `1.5px solid ${COLORS.border}`
            }}>
              <h3 style={{
                color: COLORS.accent,
                margin: "0 0 12px 0",
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: 1
              }}>Durations (min)</h3>
              <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
                {MODES.map(m => (
                  <div key={m.key} style={{ textAlign: "center" }}>
                    <label style={{ fontWeight: 600, color: m.color }}>
                      {m.label}
                      <input
                        type="number"
                        min={1}
                        value={Math.round(durations[m.key] / 60)}
                        onChange={e => handleDurationChange(m.key, e.target.value)}
                        style={{
                          width: 48,
                          marginLeft: 8,
                          borderRadius: 6,
                          border: `1px solid ${COLORS.border}`,
                          padding: "5px 8px",
                          background: COLORS.bg,
                          color: COLORS.text,
                          fontWeight: 700,
                          fontSize: 16,
                          boxShadow: "none",
                          outline: "none"
                        }}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h3 style={{
              color: COLORS.accent,
              margin: "0 0 22px 0",
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: 1
            }}>
              Last 6 Months Contribution Map
            </h3>
            <div style={{
              width: "100%",
              maxWidth: "100%",
              overflowX: "auto",
              boxSizing: "border-box",
              paddingBottom: 12
            }}>
              <div style={{ width: "fit-content", minWidth: "100%" }}>
                <ContributionMap history={history} premiumColors={COLORS} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;