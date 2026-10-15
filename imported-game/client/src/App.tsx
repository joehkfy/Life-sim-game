import { useEffect } from "react";
import { useGameStore } from "./stores/gameStore";
import { AuthScreen } from "./components/AuthScreen";
import { CharacterCreate } from "./components/CharacterCreate";
import { World } from "./scenes/World";
import { connectSocket, disconnectSocket } from "./systems/network";

const API = import.meta.env.VITE_SERVER_URL || "";

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const token = useGameStore((s) => s.token);
  const setAuth = useGameStore((s) => s.setAuth);
  const setCharacter = useGameStore((s) => s.setCharacter);
  const logout = useGameStore((s) => s.logout);

  // Restore session on load
  useEffect(() => {
    if (!token) return;

    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Invalid session");
        return r.json();
      })
      .then((data) => {
        if (data.character) {
          setCharacter(data.character);
        } else {
          // Has token but no character yet
          useGameStore.setState({ screen: "create" });
        }
      })
      .catch(() => {
        logout();
      });
  }, []);

  // Connect socket when we enter the game
  useEffect(() => {
    if (screen === "game" && token) {
      connectSocket(token);
    }
    return () => {
      if (screen !== "game") disconnectSocket();
    };
  }, [screen, token]);

  if (screen === "auth") return <AuthScreen />;
  if (screen === "create") return <CharacterCreate />;
  return <World />;
}
