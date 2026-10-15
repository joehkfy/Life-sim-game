import { useGameStore } from "../../../stores/gameStore";

export function ProfileApp({ onBack }: { onBack: () => void }) {
  const character = useGameStore((s) => s.character);
  if (!character) return null;

  return (
    <div className="phone-app">
      <div className="phone-app-header">
        <button className="phone-back" onClick={onBack}>‹</button>
        <span>Profile</span>
        <span />
      </div>
      <div className="phone-app-body">
        <div className="bank-card">
          <div style={{ fontSize: 22, fontWeight: 700 }}>{character.name}</div>
          <div style={{ opacity: 0.7 }}>Age {character.age} · {character.personality}</div>
        </div>
        <div className="phone-section">Skills</div>
        {[
          ["Intelligence", character.skills.intelligence],
          ["Strength", character.skills.strength],
          ["Charisma", character.skills.charisma],
          ["Creativity", character.skills.creativity],
          ["Cooking", character.skills.cooking],
          ["Fitness", character.skills.fitness],
        ].map(([label, val]) => (
          <div key={label as string} className="phone-row">
            <div className="phone-row-title">{label}</div>
            <div className="phone-row-sub">{(val as number).toFixed(0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
