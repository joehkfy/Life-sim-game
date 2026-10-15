import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function NotificationsApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const [items, setItems] = useState<any[]>([]);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  function load() {
    fetch(`${API}/api/game/notifications`, { headers })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setItems(d))
      .catch(() => {});
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  async function markAll() {
    await fetch(`${API}/api/game/notifications/read`, {
      method: "POST",
      headers,
      body: "{}",
    });
    load();
  }

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Alerts</span>
        <button className="phone-header-action" onClick={markAll} style={{ fontSize: 12, color: "#a29bfe" }}>
          Read all
        </button>
      </div>
      <div className="phone-app-body">
        {items.length === 0 && <p className="phone-empty">No notifications</p>}
        {items.map((n) => (
          <div
            key={n.id}
            className="phone-card"
            style={{ opacity: n.read ? 0.55 : 1, borderLeft: n.read ? undefined : "3px solid #6c5ce7" }}
          >
            <div className="phone-row-title">{n.title}</div>
            <div className="phone-row-sub">{n.body}</div>
            <div className="phone-row-sub" style={{ marginTop: 4, fontSize: 10 }}>
              {n.type} · {new Date(n.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
