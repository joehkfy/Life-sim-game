import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function MarketApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [listings, setListings] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [itemKey, setItemKey] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("10");
  const [msg, setMsg] = useState("");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  function refresh() {
    fetch(`${API}/api/game/market`, { headers })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setListings(d))
      .catch(() => {});
  }

  useEffect(() => {
    if (!token) return;
    refresh();
    fetch(`${API}/api/game/items`, { headers })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setItems(d))
      .catch(() => {});
  }, [token]);

  async function buy(listingId: string) {
    setMsg("");
    const r = await fetch(`${API}/api/game/market/buy`, {
      method: "POST",
      headers,
      body: JSON.stringify({ listingId }),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message);
      refresh();
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
    }
  }

  async function sell() {
    setMsg("");
    const r = await fetch(`${API}/api/game/market/list`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        itemKey,
        quantity: Number(qty),
        priceEach: Math.floor(Number(price)),
      }),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message);
      refresh();
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
    }
  }

  async function cancel(listingId: string) {
    const r = await fetch(`${API}/api/game/market/cancel`, {
      method: "POST",
      headers,
      body: JSON.stringify({ listingId }),
    });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message);
      refresh();
    }
  }

  const inv = character?.inventory || [];

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Market</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}
        <div className="phone-btn-row" style={{ marginBottom: 10 }}>
          <button className={`phone-btn ${tab === "buy" ? "ok" : ""}`} style={{ flex: 1 }} onClick={() => setTab("buy")}>
            Buy
          </button>
          <button className={`phone-btn ${tab === "sell" ? "ok" : ""}`} style={{ flex: 1 }} onClick={() => setTab("sell")}>
            Sell
          </button>
        </div>

        {tab === "buy" && (
          <>
            {listings.length === 0 && <p className="phone-empty">No listings — sell something!</p>}
            {listings.map((l) => {
              const def = items.find((i) => i.key === l.itemKey);
              const mine = l.sellerId === character?.id;
              return (
                <div key={l.id} className="phone-card">
                  <div className="phone-row-title">
                    {def?.icon || "📦"} {def?.name || l.itemKey} ×{l.quantity}
                  </div>
                  <div className="phone-row-sub">${l.priceEach} each · ${l.priceEach * l.quantity} total</div>
                  {mine ? (
                    <button className="phone-mini-btn bad" style={{ marginTop: 6 }} onClick={() => cancel(l.id)}>
                      Cancel listing
                    </button>
                  ) : (
                    <button className="phone-mini-btn ok" style={{ marginTop: 6 }} onClick={() => buy(l.id)}>
                      Buy
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === "sell" && (
          <>
            <p className="phone-empty" style={{ textAlign: "left", padding: "0 0 8px" }}>
              List items from your inventory for other players to buy.
            </p>
            <select
              className="phone-input"
              value={itemKey}
              onChange={(e) => setItemKey(e.target.value)}
            >
              <option value="">Select item…</option>
              {inv.map((slot: any) => {
                const def = items.find((i) => i.key === slot.itemKey);
                return (
                  <option key={slot.id} value={slot.itemKey}>
                    {def?.name || slot.itemKey} (×{slot.quantity})
                  </option>
                );
              })}
            </select>
            <input className="phone-input" type="number" placeholder="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
            <input className="phone-input" type="number" placeholder="Price each" value={price} onChange={(e) => setPrice(e.target.value)} />
            <button className="phone-btn ok full" onClick={sell} disabled={!itemKey}>
              List for sale
            </button>
          </>
        )}
      </div>
    </div>
  );
}
