import React, { useState, useRef, useEffect } from "react";
import ContributionMap from "./ContributionMap.jsx";
import TimerCircle from "./TimerCircle.jsx";
import soundFocus from "./ding.mp3";
import soundBreak from "./ding-break.mp3";

// --- API SYNC HELPERS ---
const API_URL = "https://script.google.com/macros/s/AKfycbxRLznvfGO_bMX1sMymAbS96Mye-Qd2j7QiBf7CcOGK-tE1M7L7qN4iYXpDks02l-NqlA/exec";
async function fetchFromAPI(key) {
  const res = await fetch(`${API_URL}?action=${key}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}
async function syncToAPI(action, key, value) {
  const res = await fetch(`${API_URL}?action=${action}&key=${key}&value=${value}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

const COLORS = {
  bg: "#161925", surface: "#23263a", accent: "#8edfff", accentSoft: "#aee7ff", accentFade: "#e4f7ff",
  focus: "#4adc89", break: "#ffd66e", longBreak: "#ff7cb9", text: "#e0e6f0", textSoft: "#a7b2cc",
  border: "#2e3147", shadow: "0 4px 16px 0 rgba(54,90,255,0.08)", button: "#24305e",
  buttonActive: "#8edfff", tabActive: "#2c3254", danger: "#ff4b5c",
};

const DEFAULT_DURATIONS = { focus: 25 * 60, break: 5 * 60, longBreak: 15 * 60 };
const STORAGE_KEY_DUR = "pomodoro_durations";
const STORAGE_KEY_HIST = "pomodoro_history";
const STORAGE_KEY_UI = "pomodoro_ui";

const MODES = [
  { key: "focus", label: "Focus", color: COLORS.focus },
  { key: "break", label: "Break", color: COLORS.break },
  { key: "longBreak", label: "Long Break", color: COLORS.longBreak },
];

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function loadUIState() {
  try { const raw = localStorage.getItem(STORAGE_KEY_UI); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveUIState(state) {
  localStorage.setItem(STORAGE_KEY_UI, JSON.stringify(state));
}
function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function App() {
  const [tab, setTab] = useState("pomo");
  const [durations, setDurations] = useState(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY_DUR); return raw ? JSON.parse(raw) : { ...DEFAULT_DURATIONS }; }
    catch { return { ...DEFAULT_DURATIONS }; }
  });
  const [mode, setMode] = useState("focus");
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [focusCount, setFocusCount] = useState(1);
  const [history, setHistory] = useState(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY_HIST); return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
  });

  const audioFocusRef = useRef();
  const audioBreakRef = useRef();
  const finishedRef = useRef(false); // Prevents double-finish

  // Sync with background timer
  useEffect(() => {
    chrome.runtime?.sendMessage?.({ type: "GET_TIMER_STATE" }, (resp) => {
      if (resp && resp.timer) {
        setMode(resp.timer.mode);
        setTimeLeft(resp.timer.timeLeft);
        setRunning(resp.timer.running);
        setFocusCount(resp.timer.focusCount || 1);
      }
    });
    const interval = setInterval(() => {
      chrome.runtime?.sendMessage?.({ type: "GET_TIMER_STATE" }, (resp) => {
        if (resp && resp.timer) {
          setTimeLeft(resp.timer.timeLeft);
          setRunning(resp.timer.running);
          setMode(resp.timer.mode);
          setFocusCount(resp.timer.focusCount || 1);
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // API sync (no loading state, always show local instantly)
  useEffect(() => {
    fetchFromAPI("getAllDurations").then(apiDur => {
      if (apiDur && typeof apiDur === "object") {
        setDurations(apiDur);
        localStorage.setItem(STORAGE_KEY_DUR, JSON.stringify(apiDur));
        if (mode in apiDur && timeLeft > apiDur[mode]) {
          setTimeLeft(apiDur[mode]);
        }
      }
    });
    fetchFromAPI("getHistory").then(apiHist => {
      if (apiHist && typeof apiHist === "object") {
        setHistory(apiHist);
        localStorage.setItem(STORAGE_KEY_HIST, JSON.stringify(apiHist));
      }
    });
    // eslint-disable-next-line
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY_DUR, JSON.stringify(durations)); }, [durations]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_HIST, JSON.stringify(history)); }, [history]);
  useEffect(() => {
    saveUIState({
      running,
      lastTimeStamp: running ? Date.now() : null,
      timeLeft,
      mode,
      focusCount
    });
  }, [running, timeLeft, mode, focusCount]);
  useEffect(() => {
    document.title = `${formatTime(timeLeft)} - ${MODES.find(m => m.key === mode).label}`;
  }, [timeLeft, mode]);

  // Timer finish handler: react to timer hitting 0 and not running
  useEffect(() => {
    if (timeLeft === 0 && !running && !finishedRef.current) {
      finishedRef.current = true;
      handleFinish();
      handleReset(); // auto-reset after finish
    }
    if (timeLeft > 0 || running) {
      finishedRef.current = false;
    }
    // eslint-disable-next-line
  }, [timeLeft, running]);

  function handleStartPause() {
    if (running) {
      chrome.runtime?.sendMessage?.({ type: "PAUSE_TIMER" }, (resp) => {
        setRunning(false);
        setTimeLeft(resp.timer.timeLeft);
      });
    } else {
      chrome.runtime?.sendMessage?.(
        {
          type: "START_TIMER",
          mode,
          duration: durations[mode],
          remaining: timeLeft,
          focusCount,
        },
        (resp) => {
          setRunning(true);
          setTimeLeft(resp.timer.timeLeft);
        }
      );
    }
  }
  function handleReset() {
    chrome.runtime?.sendMessage?.(
      {
        type: "RESET_TIMER",
        mode,
        duration: durations[mode],
        focusCount: mode === "focus" ? 1 : focusCount,
      },
      (resp) => {
        setRunning(false);
        setTimeLeft(resp.timer.timeLeft);
      }
    );
  }
  function handleModeChange(newMode) {
    setMode(newMode);
    setFocusCount(newMode === "focus" ? 1 : focusCount);
    chrome.runtime?.sendMessage?.(
      {
        type: "RESET_TIMER",
        mode: newMode,
        duration: durations[newMode],
        focusCount: newMode === "focus" ? 1 : focusCount,
      },
      (resp) => {
        setRunning(false);
        setTimeLeft(resp.timer.timeLeft);
      }
    );
  }
  function handleDurationChange(type, val) {
    let valSec = Math.max(1, Number(val)) * 60;
    setDurations((d) => {
      const newDurations = { ...d, [type]: valSec };
      syncToAPI("updateDuration", type, valSec).catch(console.error);
      return newDurations;
    });
    if (mode === type) {
      chrome.runtime?.sendMessage?.(
        { type: "RESET_TIMER", mode, duration: valSec, focusCount },
        (resp) => {
          setRunning(false);
          setTimeLeft(resp.timer.timeLeft);
        }
      );
    }
  }
  function handleFinish() {
    // Play sound
    if (mode === "focus" && audioFocusRef.current) audioFocusRef.current.play();
    if (mode !== "focus" && audioBreakRef.current) audioBreakRef.current.play();
    // Update history (only for focus sessions)
    if (mode === "focus") {
      let today = getTodayString();
      let newVal = (history[today] || 0) + (durations.focus / 60);
      let newHistory = { ...history, [today]: newVal };
      setHistory(newHistory);
      syncToAPI("incrementHistory", today, newVal).catch(console.error);
    }
  }

  // Timer size responsive
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

  const premiumShadow =
    "0 4px 24px 0 rgba(142,223,255,0.18), 0 2px 8px 0 rgba(36,48,94,0.18)";
  const modeObj = MODES.find((m) => m.key === mode);
  const total = durations[mode];
  const percentGone = 1 - timeLeft / total;

  return (
    <div
      style={{
        fontFamily: "Inter,system-ui,sans-serif",
        maxWidth: 480,
        minHeight: "100vh",
        margin: "0 auto",
        background: COLORS.bg,
        color: COLORS.text,
        padding: 0,
        overflow: "hidden",
      }}
    >
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
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            margin: 0,
            padding: "22px 32px 10px 32px",
            fontSize: 28,
            letterSpacing: "-1px",
            fontWeight: 800,
            background: `linear-gradient(90deg, ${COLORS.accentSoft} 0%, ${COLORS.focus} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Pomodoro
        </h1>
        {/* Main Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 0,
            borderBottom: `2px solid ${COLORS.border}`,
            paddingLeft: 32,
            background: COLORS.surface,
          }}
        >
          <button
            onClick={() => setTab("pomo")}
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
              transition: "all 0.18s",
            }}
          >
            Pomodoro
          </button>
          <button
            onClick={() => setTab("history")}
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
              transition: "all 0.18s",
            }}
          >
            History
          </button>
        </div>
      </div>

      {/* Main Content, add top padding to account for fixed bar height */}
      <div style={{ padding: "120px 28px 32px 28px" }}>
        {tab === "pomo" ? (
          <div ref={timerRefDiv}>
            <div
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 24,
                justifyContent: "center",
              }}
            >
              {MODES.map((m) => (
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
                    transition: "all 0.15s",
                  }}
                  onClick={() => handleModeChange(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {/* Timer with Circle */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                margin: "5px 0 10px 0",
                width: "100%",
              }}
            >
              <TimerCircle
                size={timerWidth}
                stroke={Math.max(10, timerWidth * 0.08)}
                percent={percentGone}
                mainColor={modeObj.color}
                bgColor={COLORS.bg}
              >
                <div
                  style={{
                    fontSize: Math.max(36, timerWidth * 0.24),
                    fontWeight: 900,
                    color: modeObj.color,
                    textShadow: "0 6px 24px rgba(142,223,255,0.16)",
                  }}
                >
                  {formatTime(timeLeft)}
                </div>
              </TimerCircle>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 16,
                marginBottom: 14,
              }}
            >
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
                  transition: "background 0.18s",
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
                  transition: "background 0.18s",
                }}
              >
                Reset
              </button>
            </div>
            <div
              style={{
                margin: "16px 0 32px 0",
                color: COLORS.textSoft,
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              <span
                style={{
                  background: COLORS.surface,
                  borderRadius: 6,
                  padding: "6px 16px",
                  display: "inline-block",
                  fontWeight: 800,
                  color: COLORS.textSoft,
                  letterSpacing: 0.7,
                }}
              >
                Session:{" "}
                <span
                  style={{
                    color: COLORS.accent,
                    fontWeight: 900,
                  }}
                >
                  {mode === "focus" ? focusCount : "-"}
                </span>
              </span>
            </div>
            {/* Audio for focus and break */}
            <audio ref={audioFocusRef} src={soundFocus} preload="auto" />
            <audio ref={audioBreakRef} src={soundBreak} preload="auto" />
            <div
              style={{
                margin: "28px 0 0 0",
                background: COLORS.surface,
                borderRadius: 16,
                padding: "22px 18px 12px 18px",
                boxShadow: COLORS.shadow,
                border: `1.5px solid ${COLORS.border}`,
              }}
            >
              <h3
                style={{
                  color: COLORS.accent,
                  margin: "0 0 12px 0",
                  fontWeight: 700,
                  fontSize: 16,
                  letterSpacing: 1,
                }}
              >
                Durations (min)
              </h3>
              <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
                {MODES.map((m) => (
                  <div key={m.key} style={{ textAlign: "center" }}>
                    <label style={{ fontWeight: 600, color: m.color }}>
                      {m.label}
                      <input
                        type="number"
                        min={1}
                        value={Math.round(durations[m.key] / 60)}
                        onChange={(e) => handleDurationChange(m.key, e.target.value)}
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
                          outline: "none",
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
            <h3
              style={{
                color: COLORS.accent,
                margin: "0 0 22px 0",
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: 1,
              }}
            >
              Last 6 Months Contribution Map
            </h3>
            <div
              style={{
                width: "100%",
                maxWidth: "100%",
                overflowX: "auto",
                boxSizing: "border-box",
                paddingBottom: 12,
              }}
            >
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