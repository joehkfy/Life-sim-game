import { useState } from "react";
import { useGameStore } from "../stores/gameStore";

const API = import.meta.env.VITE_SERVER_URL || "";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useGameStore((s) => s.setAuth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { username, email, password };

      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setAuth(data.token, data.user, data.hasCharacter);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Life Sim</h1>
        <p className="subtitle">A persistent multiplayer world</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <label>Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={20}
                autoComplete="username"
              />
            </>
          )}

          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "login" ? 1 : 8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        <div className="switch">
          {mode === "login" ? (
            <>
              No account? <span onClick={() => setMode("register")}>Register</span>
            </>
          ) : (
            <>
              Already have an account? <span onClick={() => setMode("login")}>Log In</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
