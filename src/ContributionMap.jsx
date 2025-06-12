import React, { useMemo } from "react";

// Premium blue gradient for activity
const DEFAULT_LEVELS = [
  { min: 0, max: 0, color: "#252c3d" },     // 0
  { min: 1, max: 20, color: "#7ed0f9" },    // 0:01-0:20
  { min: 21, max: 60, color: "#47a7e7" },   // 0:21-1:00
  { min: 61, max: 120, color: "#3396e3" },  // 1:01-2:00
  { min: 121, max: 10000, color: "#086cb7" } // 2:01+
];

function getLast6MonthsGrid(history) {
  const grid = [];
  const today = new Date();
  let d = new Date(today); // Start from today
  for (let i = 0; i < 7 * 26; ++i) {
    const dateStr = d.toISOString().slice(0, 10);
    grid.unshift({
      date: dateStr,
      min: Math.round((history[dateStr] || 0)),
    });
    d.setDate(d.getDate() - 1);
  }
  // LEFT: recent, RIGHT: oldest
  // So reverse the array of weeks to put most recent week at left
  const weeks = Array.from({ length: 26 }, (_, i) =>
    grid.slice(i * 7, i * 7 + 7)
  ).reverse();
  return weeks;
}

function getLevel(min, levels) {
  for (let l of levels) if (min >= l.min && min <= l.max) return l;
  return levels[0];
}

function minToStr(min) {
  if (min === 0) return "0:00";
  if (min <= 20) return "0:20";
  if (min <= 60) return "1:00";
  if (min <= 120) return "2:00";
  return "4:00+";
}

const ContributionMap = ({ history, premiumColors }) => {
  // Allow custom premium palette
  const levels = premiumColors ? [
    { min: 0, max: 0, color: "#252c3d" },
    { min: 1, max: 20, color: "#7ed0f9" },
    { min: 21, max: 60, color: "#47a7e7" },
    { min: 61, max: 120, color: "#3396e3" },
    { min: 121, max: 10000, color: "#086cb7" }
  ] : DEFAULT_LEVELS;
  const grid = useMemo(() => getLast6MonthsGrid(history), [history]);
  return (
    <div>
      <div style={{
        display: "flex",
        flexDirection: "row",
        gap: 3,
        width: "fit-content",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}>
        {grid.map((week, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {week.map((cell, j) => {
              const level = getLevel(cell.min, levels);
              return (
                <div
                  key={j}
                  title={`${cell.date}\n${minToStr(cell.min)}`}
                  style={{
                    width: 17,
                    height: 17,
                    background: level.color,
                    borderRadius: 5,
                    border: "1.5px solid #23263a",
                    boxSizing: "border-box",
                    transition: "background 0.14s"
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      {/* Heatmap legend below the heatmap */}
      <div style={{
        fontSize: 13,
        color: (premiumColors && premiumColors.textSoft) || "#a7b2cc",
        marginTop: 16,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap"
      }}>
        <span style={{ marginRight: 8 }}>Legend:</span>
        <span style={{
          background: "#252c3d",
          color: "#a7b2cc",
          padding: "3px 10px",
          borderRadius: 4,
          fontWeight: 700
        }}>0:00</span>
        <span style={{
          background: "#7ed0f9",
          color: "#161925",
          padding: "3px 10px",
          borderRadius: 4,
          marginLeft: 4,
          fontWeight: 700
        }}>0:20</span>
        <span style={{
          background: "#47a7e7",
          color: "#161925",
          padding: "3px 10px",
          borderRadius: 4,
          marginLeft: 4,
          fontWeight: 700
        }}>1:00</span>
        <span style={{
          background: "#3396e3",
          color: "#fff",
          padding: "3px 10px",
          borderRadius: 4,
          marginLeft: 4,
          fontWeight: 700
        }}>2:00</span>
        <span style={{
          background: "#086cb7",
          color: "#fff",
          padding: "3px 10px",
          borderRadius: 4,
          marginLeft: 4,
          fontWeight: 700
        }}>4:00+</span>
      </div>
    </div>
  );
};

export default ContributionMap;