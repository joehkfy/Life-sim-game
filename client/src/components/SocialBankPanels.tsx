import { useState, useEffect } from "react";
import { useGameStore } from "../stores/gameStore";
import { sendChat } from "../systems/network";

const API = import.meta.env.VITE_SERVER_URL || "";

type Tab = "friends" | "messages" | "bank" | "housing";

export function SocialBankPanels({
  open,
  onClose,
  initialTab = "friends",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
}) {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [dmTarget, setDmTarget] = useState<{ id: string; name: string } | null>(null);
  const [dmHistory, setDmHistory] = useState<any[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [bankAmount, setBankAmount] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [properties, setProperties] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  async function refreshCharacter() {
    const r = await fetch(`${API}/api/game/character`, { headers });
    if (r.ok) setCharacter(await r.json());
  }

  async function api(method: string, path: string, body?: object) {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      if (data.message) setMsg(data.message);
      await refreshCharacter();
      return data;
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !token) return;
    setTab(initialTab);
    fetch(`${API}/api/game/friends`, { headers }).then((r) => r.json()).then(setFriends).catch(() => {});
    fetch(`${API}/api/game/friends/requests`, { headers }).then((r) => r.json()).then(setRequests).catch(() => {});
    fetch(`${API}/api/game/properties`, { headers }).then((r) => r.json()).then(setProperties).catch(() => {});
  }, [open, token, initialTab]);

  useEffect(() => {
    if (!dmTarget || !token) return;
    fetch(`${API}/api/game/messages/${dmTarget.id}`, { headers })
      .then((r) => r.json())
      .then(setDmHistory)
      .catch(() => {});
  }, [dmTarget, token]);

  async function doSearch() {
    if (search.length < 2) return;
    const r = await fetch(`${API}/api/game/players/search?q=${encodeURIComponent(search)}`, { headers });
    if (r.ok) setSearchResults(await r.json());
  }

  function sendDM() {
    if (!dmTarget || !dmInput.trim()) return;
    sendChat(dmInput.trim(), "private", dmTarget.id);
    setDmHistory((h) => [
      ...h,
      {
        fromId: character?.id,
        fromName: character?.name,
        content: dmInput.trim(),
        createdAt: new Date().toISOString(),
      },
    ]);
    setDmInput("");
  }

  if (!open || !character) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          width: "min(440px, 94vw)",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          color: "var(--text)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {(
            [
              ["friends", "Friends"],
              ["messages", "Messages"],
              ["bank", "Bank"],
              ["housing", "Home"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                flex: 1,
                padding: "12px 8px",
                background: tab === k ? "var(--accent)" : "transparent",
                border: "none",
                color: "var(--text)",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
          {msg && (
            <div
              style={{
                background: "rgba(108,92,231,0.2)",
                padding: "8px 12px",
                borderRadius: 8,
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              {msg}
            </div>
          )}

          {/* FRIENDS */}
          {tab === "friends" && (
            <div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players..."
                  style={inputStyle}
                />
                <button onClick={doSearch} style={btnStyle} disabled={loading}>
                  Search
                </button>
              </div>

              {searchResults.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Results</div>
                  {searchResults.map((p) => (
                    <div key={p.id} style={rowStyle}>
                      <span>{p.name}</span>
                      <button
                        style={btnStyle}
                        disabled={loading}
                        onClick={() => api("POST", "/api/game/friends/request", { toCharacterId: p.id })}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {requests.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                    Requests ({requests.length})
                  </div>
                  {requests.map((r) => (
                    <div key={r.id} style={rowStyle}>
                      <span>{r.fromName}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          style={{ ...btnStyle, background: "var(--success)" }}
                          onClick={async () => {
                            await api("POST", "/api/game/friends/respond", {
                              requestId: r.id,
                              accept: true,
                            });
                            setRequests((x) => x.filter((i) => i.id !== r.id));
                            const fr = await fetch(`${API}/api/game/friends`, { headers });
                            if (fr.ok) setFriends(await fr.json());
                          }}
                        >
                          Accept
                        </button>
                        <button
                          style={{ ...btnStyle, background: "var(--danger)" }}
                          onClick={async () => {
                            await api("POST", "/api/game/friends/respond", {
                              requestId: r.id,
                              accept: false,
                            });
                            setRequests((x) => x.filter((i) => i.id !== r.id));
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                Friends ({friends.length})
              </div>
              {friends.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No friends yet. Search and add players.</p>
              )}
              {friends.map((f) => (
                <div key={f.id} style={rowStyle}>
                  <span>{f.name}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      style={btnStyle}
                      onClick={() => {
                        setDmTarget({ id: f.id, name: f.name });
                        setTab("messages");
                      }}
                    >
                      Message
                    </button>
                    <button
                      style={{ ...btnStyle, background: "var(--danger)" }}
                      onClick={async () => {
                        await api("POST", "/api/game/friends/remove", { friendId: f.id });
                        setFriends((x) => x.filter((i) => i.id !== f.id));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MESSAGES */}
          {tab === "messages" && (
            <div>
              {!dmTarget ? (
                <div>
                  <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 8 }}>
                    Select a friend to message
                  </p>
                  {friends.map((f) => (
                    <div
                      key={f.id}
                      style={{ ...rowStyle, cursor: "pointer" }}
                      onClick={() => setDmTarget({ id: f.id, name: f.name })}
                    >
                      <span>{f.name}</span>
                      <span style={{ color: "var(--accent)", fontSize: 12 }}>Open →</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <strong>{dmTarget.name}</strong>
                    <button
                      onClick={() => setDmTarget(null)}
                      style={{ background: "none", border: "none", color: "var(--muted)" }}
                    >
                      ← Back
                    </button>
                  </div>
                  <div
                    style={{
                      height: 200,
                      overflowY: "auto",
                      background: "rgba(0,0,0,0.25)",
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 8,
                      fontSize: 13,
                    }}
                  >
                    {dmHistory.map((m, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        <span style={{ color: "#a29bfe", fontWeight: 600 }}>{m.fromName}: </span>
                        {m.content}
                      </div>
                    ))}
                    {dmHistory.length === 0 && (
                      <div style={{ color: "var(--muted)" }}>No messages yet</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={dmInput}
                      onChange={(e) => setDmInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendDM()}
                      placeholder="Private message..."
                      style={inputStyle}
                      maxLength={500}
                    />
                    <button onClick={sendDM} style={btnStyle}>
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BANK */}
          {tab === "bank" && (
            <div>
              <div
                style={{
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Cash on hand</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#55efc4" }}>
                  ${character.stats.money.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>Bank balance</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#74b9ff" }}>
                  ${(character.stats.bankBalance ?? 0).toFixed(2)}
                </div>
              </div>

              <input
                type="number"
                value={bankAmount}
                onChange={(e) => setBankAmount(e.target.value)}
                placeholder="Amount"
                style={{ ...inputStyle, marginBottom: 8 }}
                min={1}
              />
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                  style={{ ...btnStyle, flex: 1, background: "var(--success)" }}
                  disabled={loading}
                  onClick={() => api("POST", "/api/game/bank/deposit", { amount: Number(bankAmount) })}
                >
                  Deposit
                </button>
                <button
                  style={{ ...btnStyle, flex: 1 }}
                  disabled={loading}
                  onClick={() => api("POST", "/api/game/bank/withdraw", { amount: Number(bankAmount) })}
                >
                  Withdraw
                </button>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Transfer to player</div>
              <input
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                placeholder="Friend character ID or search name"
                style={{ ...inputStyle, marginBottom: 6 }}
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {friends.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTransferTo(f.id)}
                    style={{
                      ...btnStyle,
                      background: transferTo === f.id ? "var(--accent)" : "rgba(255,255,255,0.08)",
                      fontSize: 11,
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <button
                style={{ ...btnStyle, width: "100%" }}
                disabled={loading || !transferTo}
                onClick={() =>
                  api("POST", "/api/game/bank/transfer", {
                    toCharacterId: transferTo,
                    amount: Number(bankAmount),
                  })
                }
              >
                Transfer ${bankAmount || "0"}
              </button>
            </div>
          )}

          {/* HOUSING */}
          {tab === "housing" && (
            <div>
              {character.homeId ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>You have a home</div>
                  <button
                    style={{ ...btnStyle, width: "100%", marginBottom: 8, background: "var(--success)" }}
                    disabled={loading}
                    onClick={() =>
                      api("POST", "/api/game/location/enter", {
                        locationKey: `home_${character.homeId}`,
                      })
                    }
                  >
                    Enter Home
                  </button>
                  <button
                    style={{ ...btnStyle, width: "100%", background: "var(--danger)" }}
                    disabled={loading}
                    onClick={() => api("POST", "/api/game/properties/leave", {})}
                  >
                    Leave / Sell Home
                  </button>
                </div>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
                  No home yet. Rent or buy below.
                </p>
              )}

              {properties.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {p.type} · Buy ${p.price}
                    {p.rent > 0 ? ` · Rent $${p.rent}/mo` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: p.ownerId || p.tenantId ? "var(--danger)" : "var(--success)" }}>
                    {p.ownerId || p.tenantId ? "Occupied" : "Available"}
                  </div>
                  {!p.ownerId && !p.tenantId && (!character.homeId || properties.find((owned) => owned.id === character.homeId)?.isStarterHome) && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      {p.rent > 0 && (
                        <button
                          style={btnStyle}
                          disabled={loading}
                          onClick={() => api("POST", "/api/game/properties/rent", { propertyId: p.id })}
                        >
                          Rent ${p.rent}
                        </button>
                      )}
                      <button
                        style={{ ...btnStyle, background: "var(--success)" }}
                        disabled={loading}
                        onClick={() => api("POST", "/api/game/properties/buy", { propertyId: p.id })}
                      >
                        Buy ${p.price}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            padding: 12,
            background: "transparent",
            border: "none",
            borderTop: "1px solid var(--border)",
            color: "var(--muted)",
            fontWeight: 600,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  width: "100%",
};

const btnStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  color: "white",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid var(--border)",
  gap: 8,
};
