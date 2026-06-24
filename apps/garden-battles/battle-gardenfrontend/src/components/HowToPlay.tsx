import { useState } from "react";

export default function HowToPlay() {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return localStorage.getItem("howToPlay_collapsed") !== "true";
    } catch {
      return true;
    }
  });

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    try {
      localStorage.setItem("howToPlay_collapsed", next ? "false" : "true");
    } catch {}
  };

  return (
    <div
      style={{
        margin: "15px auto",
        maxWidth: "95%",
        width: "750px",
        background: "rgba(0, 30, 60, 0.85)",
        border: "2px solid #00ccff",
        borderRadius: "14px",
        boxShadow: "0 0 18px rgba(0,200,255,0.3)",
        overflow: "hidden",
        fontFamily: "Orbitron, sans-serif",
      }}
    >
      {/* Header / toggle */}
      <button
        onClick={toggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: "rgba(0, 50, 100, 0.7)",
          border: "none",
          cursor: "pointer",
          color: "#00ccff",
          fontFamily: "Orbitron, sans-serif",
          fontSize: "clamp(13px, 3vw, 16px)",
          fontWeight: "bold",
          letterSpacing: "1px",
          textTransform: "uppercase",
          textShadow: "0 0 8px #00ccff",
        }}
        data-testid="button-how-to-play-toggle"
      >
        <span>💡 How to Play — The Garden Battles</span>
        <span
          style={{
            fontSize: "18px",
            transition: "transform 0.3s ease",
            display: "inline-block",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>

      {/* Collapsible body */}
      <div
        style={{
          maxHeight: isOpen ? "600px" : "0",
          overflow: "hidden",
          transition: "max-height 0.4s ease",
        }}
      >
        <div style={{ padding: "16px 20px 20px" }}>
          {/* Three cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            {/* Objective */}
            <div
              style={{
                background: "rgba(0,100,0,0.25)",
                border: "1px solid #00ff88",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <div style={{ fontSize: "26px", marginBottom: "8px" }}>🌳</div>
              <div
                style={{
                  color: "#00ff88",
                  fontWeight: "bold",
                  fontSize: "13px",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                The Goal
              </div>
              <div style={{ color: "#ccffee", fontSize: "12px", lineHeight: "1.6" }}>
                Grow your tree to <strong style={{ color: "#00ff00" }}>100 Growth</strong> before your opponent does. Watch the green bar — first to 100 wins the pot!
              </div>
            </div>

            {/* Moves */}
            <div
              style={{
                background: "rgba(100,0,0,0.25)",
                border: "1px solid #ff6644",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <div style={{ fontSize: "26px", marginBottom: "8px" }}>⚔️</div>
              <div
                style={{
                  color: "#ff8866",
                  fontWeight: "bold",
                  fontSize: "13px",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                Your Moves
              </div>
              <div style={{ color: "#ffccbb", fontSize: "12px", lineHeight: "1.6" }}>
                You get <strong style={{ color: "#ff8866" }}>2 Attack moves</strong> (drain opponent's growth) and <strong style={{ color: "#88ff88" }}>2 Growth moves</strong> (boost your own tree). Choose wisely each turn.
              </div>
            </div>

            {/* Turns */}
            <div
              style={{
                background: "rgba(0,30,100,0.35)",
                border: "1px solid #44aaff",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <div style={{ fontSize: "26px", marginBottom: "8px" }}>🔄</div>
              <div
                style={{
                  color: "#66bbff",
                  fontWeight: "bold",
                  fontSize: "13px",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                }}
              >
                Turn Order
              </div>
              <div style={{ color: "#bbddff", fontSize: "12px", lineHeight: "1.6" }}>
                Players alternate turns. <strong style={{ color: "#66bbff" }}>Each move = 1 wallet confirmation.</strong> When it's your turn, pick a move and approve the transaction. Then wait for your opponent's turn.
              </div>
            </div>
          </div>

          {/* Quick strategy tip */}
          <div
            style={{
              background: "rgba(80,60,0,0.35)",
              border: "1px solid #ffcc00",
              borderRadius: "10px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "20px", flexShrink: 0 }}>🎯</span>
            <div style={{ color: "#ffe88a", fontSize: "12px", lineHeight: "1.6" }}>
              <strong style={{ color: "#ffcc00" }}>Pro Tip:</strong> Growth moves (🌱) raise YOUR bar. Attack moves (⚔️) lower your OPPONENT'S bar. Both paths win — but attacking your opponent early can be decisive since you only use one move per turn.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
