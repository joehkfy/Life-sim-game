import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";
import { sendChat } from "../../../systems/network";

const API = import.meta.env.VITE_SERVER_URL || "";

export function MessagesApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const [friends, setFriends] = useState<any[]>([]);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [input, setInput] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/game/friends`, { headers })
      .then((r) => r.json())
      .then(setFriends)
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!target || !token) return;
    fetch(`${API}/api/game/messages/${target.id}`, { headers })
      .then((r) => r.json())
      .then(setHistory)
      .catch(() => {});
  }, [target, token]);

  function send() {
    if (!target || !input.trim()) return;
    sendChat(input.trim(), "private", target.id);
    setHistory((h) => [
      ...h,
      { fromId: character?.id, fromName: character?.name, content: input.trim() },
    ]);
    setInput("");
  }

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={target ? () => setTarget(null) : onBack}>
          ‹
        </button>
        <span>{target ? target.name : "Messages"}</span>
        <span />
      </div>
      <div className="phone-app-body">
        {!target ? (
          <>
            {friends.length === 0 && (
              <p className="phone-empty">Add friends in Contacts to message them.</p>
            )}
            {friends.map((f) => (
              <button key={f.id} className="phone-row" onClick={() => setTarget({ id: f.id, name: f.name })}>
                <div className="phone-row-avatar">{f.name.charAt(0)}</div>
                <div className="phone-row-text">
                  <div className="phone-row-title">{f.name}</div>
                  <div className="phone-row-sub">Tap to open chat</div>
                </div>
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="phone-chat-log">
              {history.map((m, i) => (
                <div
                  key={i}
                  className={`phone-bubble ${m.fromId === character?.id ? "mine" : "theirs"}`}
                >
                  {m.content}
                </div>
              ))}
              {history.length === 0 && <p className="phone-empty">No messages yet</p>}
            </div>
            <div className="phone-chat-input">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Message..."
                maxLength={500}
              />
              <button onClick={send}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
