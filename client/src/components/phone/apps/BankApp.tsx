import { useState, useEffect } from "react";
import { useGameStore } from "../../../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function BankApp({ onBack }: { onBack: () => void }) {
  const token = useGameStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [friends, setFriends] = useState<any[]>([]);
  const [toId, setToId] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/api/game/friends`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setFriends)
      .catch(() => {});
  }, [token]);

  async function act(path: string, body: object) {
    const r = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "Failed");
    else {
      setMsg(d.message || "OK");
      const cr = await fetch(`${API}/api/game/character`, { headers });
      if (cr.ok) setCharacter(await cr.json());
    }
  }

  if (!character) return null;

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Bank</span>
        <span />
      </div>
      <div className="phone-app-body">
        {msg && <div className="phone-toast">{msg}</div>}
        <div className="bank-card">
          <div className="bank-label">Cash</div>
          <div className="bank-value cash">${character.stats.money.toFixed(2)}</div>
          <div className="bank-label">Bank balance</div>
          <div className="bank-value bank">${(character.stats.bankBalance ?? 0).toFixed(2)}</div>
        </div>
        <input
          className="phone-input"
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="phone-btn-row">
          <button className="phone-btn ok" onClick={() => act("/api/game/bank/deposit", { amount: Number(amount) })}>
            Deposit
          </button>
          <button className="phone-btn" onClick={() => act("/api/game/bank/withdraw", { amount: Number(amount) })}>
            Withdraw
          </button>
        </div>
        <div className="phone-section">Transfer</div>
        <div className="phone-chip-row">
          {friends.map((f) => (
            <button key={f.id} className={`phone-chip ${toId === f.id ? "active" : ""}`} onClick={() => setToId(f.id)}>
              {f.name}
            </button>
          ))}
        </div>
        <button
          className="phone-btn full"
          disabled={!toId}
          onClick={() => act("/api/game/bank/transfer", { toCharacterId: toId, amount: Number(amount) })}
        >
          Transfer ${amount || "0"}
        </button>
      </div>
    </div>
  );
}
