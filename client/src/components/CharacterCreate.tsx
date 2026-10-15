import { useState, useEffect } from "react";
import { useGameStore } from "../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

const HAIR_STYLES = ["Short", "Full", "Long sides", "Volume"];
const FACE_PRESETS = ["Default", "Round", "Sharp"];
const TOPS = ["Casual", "Shirt", "Hoodie"];
const BOTTOMS = ["Jeans", "Shorts", "Pants"];

export function CharacterCreate() {
  const token = useGameStore((s) => s.token);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const [name, setName] = useState("");
  const [lifeStage, setLifeStage] = useState<"child" | "adult">("adult");
  const [countryCode, setCountryCode] = useState("NG");
  const [stateCode, setStateCode] = useState("");
  const [cityKey, setCityKey] = useState("lagos");
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [appearance, setAppearance] = useState({
    skinTone: 0.55,
    hairStyle: 0,
    hairColor: "#2c1810",
    facePreset: 0,
    clothingTop: 0,
    clothingBottom: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/game/world/countries`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setCountries(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!countryCode) return;
    fetch(`${API}/api/game/world/states?country=${countryCode}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length) {
          setStates(d);
          setStateCode(d[0].code);
        } else {
          setStates([]);
          setStateCode("");
        }
      })
      .catch(() => setStates([]));
  }, [countryCode]);

  useEffect(() => {
    if (!countryCode) return;
    const q = stateCode
      ? `country=${countryCode}&state=${stateCode}`
      : `country=${countryCode}`;
    fetch(`${API}/api/game/world/cities?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length) {
          setCities(d);
          setCityKey(d[0].key);
        } else setCities([]);
      })
      .catch(() => setCities([]));
  }, [countryCode, stateCode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/api/game/character`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          personality: "friendly",
          appearance,
          countryCode,
          stateCode,
          cityKey,
          lifeStage,
          age: lifeStage === "child" ? 10 : 22,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setCharacter(d);
    } catch (err: any) {
      setError(err.message || "Failed to create");
    } finally {
      setLoading(false);
    }
  }

  const selectedCountry = countries.find((c) => c.code === countryCode);

  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ maxWidth: 460, maxHeight: "92vh", overflowY: "auto" }}>
        <h1>Create Character</h1>
        <p style={{ opacity: 0.75, marginBottom: 12, fontSize: 13 }}>
          60+ countries · 15+ states each · pick where you live. Only that city loads in 3D. Everyone starts with $500 game money and a starter home, wherever they live.
        </p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={submit}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={24} />

          <label>Life stage</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button type="button" className={lifeStage === "child" ? "primary" : ""} onClick={() => setLifeStage("child")} style={{ flex: 1 }}>
              🧒 Child
            </button>
            <button type="button" className={lifeStage === "adult" ? "primary" : ""} onClick={() => setLifeStage("adult")} style={{ flex: 1 }}>
              🧑 Adult
            </button>
          </div>

          <label>Country ({countries.length || "…"})</label>
          <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
            {countries.length === 0 && <option value="NG">Nigeria</option>}
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} · {c._count?.states ?? c.states?.length ?? "—"} states · {c.currencySymbol || c.currencyCode}
              </option>
            ))}
          </select>
          {selectedCountry && (
            <p style={{ fontSize: 12, opacity: 0.75 }}>
              Money: {selectedCountry.currencySymbol} {selectedCountry.currencyCode}
            </p>
          )}

          <label>State / Region ({states.length || "…"})</label>
          <select value={stateCode} onChange={(e) => setStateCode(e.target.value)} disabled={!states.length}>
            {states.length === 0 && <option value="">Loading…</option>}
            {states.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.cities?.length || 0} cities)
              </option>
            ))}
          </select>

          <label>City</label>
          <select value={cityKey} onChange={(e) => setCityKey(e.target.value)}>
            {cities.length === 0 && <option value="lagos">Lagos</option>}
            {cities.map((c) => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div>
              <label>Skin tone</label>
              <input type="range" min={0} max={1} step={0.05} value={appearance.skinTone}
                onChange={(e) => setAppearance({ ...appearance, skinTone: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label>Hair</label>
              <select value={appearance.hairStyle} onChange={(e) => setAppearance({ ...appearance, hairStyle: parseInt(e.target.value) })}>
                {HAIR_STYLES.map((h, i) => <option key={h} value={i}>{h}</option>)}
              </select>
            </div>
            <div>
              <label>Hair color</label>
              <input type="color" value={appearance.hairColor}
                onChange={(e) => setAppearance({ ...appearance, hairColor: e.target.value })} />
            </div>
            <div>
              <label>Face</label>
              <select value={appearance.facePreset} onChange={(e) => setAppearance({ ...appearance, facePreset: parseInt(e.target.value) })}>
                {FACE_PRESETS.map((f, i) => <option key={f} value={i}>{f}</option>)}
              </select>
            </div>
          </div>

          <button className="primary" type="submit" disabled={loading} style={{ marginTop: 16, width: "100%" }}>
            {loading ? "Creating..." : "Enter the World"}
          </button>
        </form>
      </div>
    </div>
  );
}
