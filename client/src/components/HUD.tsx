import { useState } from "react";
import { useGameStore } from "../stores/gameStore";
import { sendChat, disconnectSocket } from "../systems/network";

function formatTime(hours: number) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  const period = h >= 12 ? "PM" : "AM";
  const display = h % 12 || 12;
  return `${display}:${m.toString().padStart(2, "0")} ${period}`;
}

export function HUD() {
  const character = useGameStore((s) => s.character);
  const worldTime = useGameStore((s) => s.worldTime);
  const worldDay = useGameStore((s) => s.worldDay);
  const weather = useGameStore((s) => s.weather);
  const chatMessages = useGameStore((s) => s.chatMessages);
  const otherPlayers = useGameStore((s) => s.otherPlayers);
  const logout = useGameStore((s) => s.logout);
  const [chatInput, setChatInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  if (!character) return null;

  function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput("");
  }

  function handleLogout() {
    disconnectSocket();
    logout();
  }

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-stats">
          <div className="name">{character.name}</div>

          <div className="stat-bar">
            <span className="label">Energy</span>
            <div className="bar">
              <div className="fill energy" style={{ width: `${Math.max(0, Math.min(100, character.stats.energy))}%` }} />
            </div>
          </div>
          <div className="stat-bar">
            <span className="label">Hunger</span>
            <div className="bar">
              <div className="fill hunger" style={{ width: `${Math.max(0, Math.min(100, character.stats.hunger))}%` }} />
            </div>
          </div>
          <div className="stat-bar">
            <span className="label">Happy</span>
            <div className="bar">
              <div className="fill happiness" style={{ width: `${Math.max(0, Math.min(100, character.stats.happiness))}%` }} />
            </div>
          </div>
          <div className="stat-bar">
            <span className="label">Health</span>
            <div className="bar">
              <div className="fill health" style={{ width: `${Math.max(0, Math.min(100, character.stats.health))}%` }} />
            </div>
          </div>
          <div className="stat-bar">
            <span className="label">Hygiene</span>
            <div className="bar">
              <div className="fill hygiene" style={{ width: `${Math.max(0, Math.min(100, character.stats.hygiene ?? 100))}%` }} />
            </div>
          </div>

          <div className="hud-money">${character.stats.money.toFixed(0)} cash</div>
          <div style={{ fontSize: 12, color: "#74b9ff" }}>🏦 ${(character.stats.bankBalance ?? 0).toFixed(0)}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            Online: {otherPlayers.size + 1}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <div className="hud-time">
            <div>Day {worldDay}</div>
            <div>{formatTime(worldTime)}</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>{weather}</div>
          </div>

          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "8px 14px",
              color: "var(--text)",
              backdropFilter: "blur(12px)",
              fontSize: 13,
            }}
          >
            Menu
          </button>

          {showMenu && (
            <div
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 12,
                minWidth: 160,
                backdropFilter: "blur(12px)",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                {character.personality} · Age {character.age}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  width: "100%",
                  padding: "8px",
                  background: "var(--danger)",
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Log Out
              </button>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, lineHeight: 1.4 }}>
                Use your Home app to furnish your house and improve daily needs
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="chat-box">
        <div className="chat-messages">
          {chatMessages.length === 0 && (
            <div style={{ color: "var(--muted)" }}>Nearby chat — say hello!</div>
          )}
          {chatMessages.map((m, i) => (
            <div key={i} className="chat-msg">
              <span className="sender">{m.fromName}: </span>
              {m.content}
            </div>
          ))}
        </div>
        <form className="chat-input-row" onSubmit={handleChat}>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            maxLength={300}
          />
          <button type="submit">Send</button>
        </form>
      </div>

      <div className="controls-hint">
        Click to capture mouse · WASD move · Shift run · Esc release mouse
      </div>
    </div>
  );
}
