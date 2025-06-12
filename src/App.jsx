import React, { useState, useRef, useEffect } from "react";
import ContributionMap from "./ContributionMap.jsx";
import TimerCircle from "./TimerCircle.jsx";
import soundFocus from "./ding.mp3";
import soundBreak from "./ding-break.mp3";

// --- GOOGLE APP SCRIPT WEB APP URL ---
const SYNC_API_URL = "https://script.google.com/macros/s/AKfycbxo5WFvIso1_7WbUREeQUGhueeb1GGCA84DpiJ75OT9JjUrl-1YkVdqYSmDME52j4g4/exec"; // <-- replace XXXX with your script ID

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
  longBreak: 15 * 60
};

const MODES = [
  { key: "focus", label: "Focus", color: COLORS.focus },
  { key: "break", label: "Break", color: COLORS.break },
  { key: "longBreak", label: "Long Break", color: COLORS.longBreak }
];

function formatTime(sec) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getNextMode(mode, focusCount) {
  if (mode === "focus") {
    return focusCount % 4 === 0 ? "longBreak" : "break";
  }
  return "focus";
}

// ------ SYNC FUNCTIONS ------
async function fetchSync(key) {
  const url = `${SYNC_API_URL}?action=get&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const txt = await res.text();
  console.log(txt);
  try {

    return JSON.parse(txt);
  } catch {
    // fallback for plain string
    return txt;
  }
}

async function putSync(key, value) {
  const body = new URLSearchParams({
    action: "put",
    key,
    value: typeof value === "string" ? value : JSON.stringify(value)
  });
  return fetch(SYNC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
}
// ----------------------------

function App() {
  // Tab state: "pomo" or "history"
  const [tab, setTab] = useState("pomo");

  // Durations (adjustable, load from localStorage or default)
  let storedDurations;
  try {
    storedDurations = JSON.parse(localStorage.getItem("pomo-durations"));
  } catch { storedDurations = null; }
  const [durations, setDurations] = useState(
    storedDurations && typeof storedDurations === "object"
      ? storedDurations
      : { ...DEFAULT_DURATIONS }
  );

  // State
  const [mode, setMode] = useState("focus");
  const [timeLeft, setTimeLeft] = useState(
    (storedDurations && storedDurations.focus) ? storedDurations.focus : DEFAULT_DURATIONS.focus
  );
  const [running, setRunning] = useState(false);
  const [focusCount, setFocusCount] = useState(1);

  // Load from localStorage
  const [history, setHistory] = useState(() =>
    JSON.parse(localStorage.getItem("pomo-history") || "{}")
  );
  const timerRef = useRef();
  const audioFocusRef = useRef();
  const audioBreakRef = useRef();

  // Save history on change
  useEffect(() => {
    localStorage.setItem("pomo-history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    document.title = `${formatTime(timeLeft)} - ${MODES.find(m => m.key === mode).label}`;
  }, [timeLeft, mode]);

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

  function handleFinish() {
    if (mode === "break" || mode === "longBreak") {
      audioBreakRef.current && audioBreakRef.current.play();
    } else {
      audioFocusRef.current && audioFocusRef.current.play();
    }
    let nextMode = getNextMode(mode, focusCount);
    let nextFocusCount = mode === "focus" ? focusCount + 1 : focusCount;
    // Save session to history
    if (mode === "focus" || mode === "break" || mode === "longBreak") {
      const today = new Date().toISOString().slice(0, 10);
      setHistory(h => {
        const prev = h[today] || 0;
        const add = durations[mode] / 60;
        return { ...h, [today]: prev + add };
      });
    }
    setTimeout(() => {
      setMode(nextMode);
      setTimeLeft(durations[nextMode]);
      setFocusCount(nextFocusCount);
      setRunning(false);
    }, 500);
  }

  function handleStartPause() {
    setRunning(r => !r);
  }

  function handleReset() {
    setRunning(false);
    setTimeLeft(durations[mode]);
  }

  function handleModeChange(newMode) {
    setRunning(false);
    setMode(newMode);
    setTimeLeft(durations[newMode]);
    if (newMode === "focus") setFocusCount(1);
  }

  function handleDurationChange(type, val) {
    let valSec = Math.max(1, Number(val)) * 60;
    setDurations(d => {
      const upd = { ...d, [type]: valSec };
      if (mode === type) setTimeLeft(valSec);
      localStorage.setItem("pomo-durations", JSON.stringify(upd));
      return upd;
    });
  }

  // Always update durations if localStorage changes (for cross-tab sync)
  useEffect(() => {
    const listener = () => {
      try {
        const newDur = JSON.parse(localStorage.getItem("pomo-durations"));
        if (newDur && typeof newDur === "object") setDurations(newDur);
      } catch {}
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);

  // Responsive scaling for timer circle
  const [timerWidth, setTimerWidth] = useState(230);
  const timerRefDiv = useRef();

  useEffect(() => {
    function updateSize() {
      if (timerRefDiv.current) {
        // 90vw, max 360px, min 180px
        const w = Math.max(180, Math.min(360, timerRefDiv.current.offsetWidth * 0.9));
        setTimerWidth(w);
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Premium gradient shadow for buttons
  const premiumShadow = "0 4px 24px 0 rgba(142,223,255,0.18), 0 2px 8px 0 rgba(36,48,94,0.18)";

  // For TimerCircle
  const modeObj = MODES.find(m => m.key === mode);
  const total = durations[mode];
  const percentGone = 1 - (timeLeft / total);

  // --- SYNC LOGIC ---
  // On mount, fetch remote values and merge into local if they exist (but don't overwrite local if already set)
  useEffect(() => {
    (async () => {
      // Only sync if local is empty
      if (!localStorage.getItem("pomo-durations")) {
        const durationsRemote = await fetchSync("pomo-durations");
        if (durationsRemote && typeof durationsRemote === "object") {
          setDurations(durationsRemote);
          localStorage.setItem("pomo-durations", JSON.stringify(durationsRemote));
        }
      }
      if (!localStorage.getItem("pomo-history")) {
        const historyRemote = await fetchSync("pomo-history");
        if (historyRemote && typeof historyRemote === "object") {
          setHistory(historyRemote);
          localStorage.setItem("pomo-history", JSON.stringify(historyRemote));
        }
      }
    })();
  }, []);

  // Whenever durations/history changes, update remote copy and localStorage
  useEffect(() => {
    putSync("pomo-durations", durations);
  }, [durations]);
  useEffect(() => {
    console.log(history);
    putSync("pomo-history", history);
  }, [history]);

  // Sync every 5 minutes (300000 ms): fetch remote and push local copy
  useEffect(() => {
    const interval = setInterval(async () => {
      // Pull remote, merge into local if different
      const [remoteDur, remoteHist] = await Promise.all([
        fetchSync("pomo-durations"),
        fetchSync("pomo-history"),
      ]);
      if (remoteDur && JSON.stringify(remoteDur) !== JSON.stringify(durations)) {
        setDurations(remoteDur);
        localStorage.setItem("pomo-durations", JSON.stringify(remoteDur));
      } else {
        putSync("pomo-durations", durations);
      }
      if (remoteHist && JSON.stringify(remoteHist) !== JSON.stringify(history)) {
        setHistory(remoteHist);
        localStorage.setItem("pomo-history", JSON.stringify(remoteHist));
      } else {
        putSync("pomo-history", history);
      }
    }, 300000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [durations, history]);
  // -------------------

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
              transition: "all 0.18s"
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
              transition: "all 0.18s"
            }}
          >
            History
          </button>
        </div>
      </div>

      {/* Main Content, add top padding to account for fixed bar height */}
      <div style={{ padding: "120px 28px 32px 28px" }}>
        {tab === "pomo" && (
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
        )}
        {tab === "history" && (
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