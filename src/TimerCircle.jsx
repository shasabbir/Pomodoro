import React from "react";

function TimerCircle({
  size = 220,
  stroke = 17,
  percent = 0,
  mainColor = "#4adc89",
  bgColor = "#161925",
  children
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * percent;

  return (
    <div style={{
      position: "relative",
      width: size,
      height: size,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <svg width={size} height={size}>
        {/* Full ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={mainColor}
          strokeWidth={stroke}
          fill="none"
          style={{ transition: "stroke 0.3s" }}
        />
        {/* Elapsed part */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.5s linear, stroke 0.3s",
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%"
          }}
        />
      </svg>
      <div style={{
        position: "absolute",
        top: 0, left: 0, width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column"
      }}>
        {children}
      </div>
    </div>
  );
}

export default TimerCircle;