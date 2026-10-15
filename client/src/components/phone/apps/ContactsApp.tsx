import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function ContactsApp({
  onBack,
  onOpenMessages,
}: {
  onBack: () => void;
  onOpenMessages: () => void;
}) {
  const token = useGameStore((s) => s.token);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  function refresh() {
    fetch(`${API}/api/game/friends`, { headers }).then((r) => r.json()).then(setFriends).catch(() => {});
    fetch(`${API}/api/game/friends/requests`, { headers }).then((r) => r.json()).then(setRequests).catch(() => {});
  }

  useEffect(() => {
    if (token) refresh();
  }, [token]);

  async function api(path: string, body: object) {
    const r = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message || "OK");
      refresh();
    }
  }

  async function doSearch() {
    if (search.length < 2) return;
    const r = await fetch(`${API}/api/game/players/search?q=${encodeURIComponent(search)}`, { headers });
    if (r.ok) setResults(await r.json());
  }

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Contacts</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}

        <div className="phone-search-row">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players..." />
          <button onClick={doSearch}>Go</button>
        </div>

        {results.map((p) => (
          <div key={p.id} className="phone-row">
            <div className="phone-row-avatar">{p.name.charAt(0)}</div>
            <div className="phone-row-text">
              <div className="phone-row-title">{p.name}</div>
            </div>
            <button className="phone-mini-btn" onClick={() => api("/api/game/friends/request", { toCharacterId: p.id })}>
              Add
            </button>
          </div>
        ))}

        {requests.length > 0 && (
          <>
            <div className="phone-section">Requests</div>
            {requests.map((r) => (
              <div key={r.id} className="phone-row">
                <div className="phone-row-avatar">{r.fromName.charAt(0)}</div>
                <div className="phone-row-text">
                  <div className="phone-row-title">{r.fromName}</div>
                </div>
                <button className="phone-mini-btn ok" onClick={() => api("/api/game/friends/respond", { requestId: r.id, accept: true })}>✓</button>
                <button className="phone-mini-btn bad" onClick={() => api("/api/game/friends/respond", { requestId: r.id, accept: false })}>✕</button>
              </div>
            ))}
          </>
        )}

        <div className="phone-section">Friends ({friends.length})</div>
        {friends.length === 0 && <p className="phone-empty">No friends yet</p>}
        {friends.map((f) => (
          <div key={f.id} className="phone-row">
            <div className="phone-row-avatar">{f.name.charAt(0)}</div>
            <div className="phone-row-text">
              <div className="phone-row-title">{f.name}</div>
            </div>
            <button className="phone-mini-btn" onClick={onOpenMessages}>💬</button>
          </div>
        ))}
      </div>
    </div>
  );
}
