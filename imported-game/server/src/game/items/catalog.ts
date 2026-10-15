import type { ItemDef } from "@life-sim/shared";

export const ITEM_CATALOG: ItemDef[] = [
  // Food
  { key: "burger", name: "Burger", description: "A filling burger. Restores hunger.", category: "food", price: 12, stackable: true, maxStack: 20, effects: { hunger: -35, energy: 5 }, icon: "🍔" },
  { key: "pizza", name: "Pizza Slice", description: "Cheesy and satisfying.", category: "food", price: 10, stackable: true, maxStack: 20, effects: { hunger: -30, happiness: 5 }, icon: "🍕" },
  { key: "salad", name: "Fresh Salad", description: "Healthy greens.", category: "food", price: 8, stackable: true, maxStack: 20, effects: { hunger: -20, health: 5 }, icon: "🥗" },
  { key: "coffee", name: "Coffee", description: "Wake up boost.", category: "food", price: 5, stackable: true, maxStack: 30, effects: { energy: 25, hunger: 5 }, icon: "☕" },
  { key: "energy_drink", name: "Energy Drink", description: "Quick energy.", category: "food", price: 7, stackable: true, maxStack: 20, effects: { energy: 40, health: -5 }, icon: "🥤" },
  { key: "apple", name: "Apple", description: "A simple healthy snack.", category: "food", price: 3, stackable: true, maxStack: 50, effects: { hunger: -10, health: 2 }, icon: "🍎" },
  { key: "ramen", name: "Ramen", description: "Warm and filling.", category: "food", price: 9, stackable: true, maxStack: 15, effects: { hunger: -28, energy: 8, happiness: 3 }, icon: "🍜" },

  // Clothing
  { key: "tshirt_blue", name: "Blue T-Shirt", description: "Casual blue shirt.", category: "clothing", price: 25, stackable: false, maxStack: 1, effects: {}, slot: "top", icon: "👕" },
  { key: "hoodie_black", name: "Black Hoodie", description: "Comfortable hoodie.", category: "clothing", price: 45, stackable: false, maxStack: 1, effects: {}, slot: "top", icon: "🧥" },
  { key: "jeans", name: "Blue Jeans", description: "Classic jeans.", category: "clothing", price: 40, stackable: false, maxStack: 1, effects: {}, slot: "bottom", icon: "👖" },
  { key: "shorts", name: "Casual Shorts", description: "Light shorts.", category: "clothing", price: 22, stackable: false, maxStack: 1, effects: {}, slot: "bottom", icon: "🩳" },
  { key: "cap", name: "Baseball Cap", description: "Casual cap.", category: "clothing", price: 18, stackable: false, maxStack: 1, effects: {}, slot: "accessory", icon: "🧢" },
  { key: "glasses", name: "Sunglasses", description: "Cool shades.", category: "clothing", price: 30, stackable: false, maxStack: 1, effects: { happiness: 2 }, slot: "accessory", icon: "🕶️" },

  // Misc / tools
  { key: "notebook", name: "Notebook", description: "For studying.", category: "tool", price: 8, stackable: true, maxStack: 10, effects: {}, icon: "📓" },
  { key: "bandage", name: "Bandage", description: "Restore a bit of health.", category: "misc", price: 15, stackable: true, maxStack: 20, effects: { health: 20 }, icon: "🩹" },
  { key: "water", name: "Water Bottle", description: "Stay hydrated.", category: "food", price: 2, stackable: true, maxStack: 30, effects: { hunger: -5, energy: 5 }, icon: "💧" },
];

export function getItem(key: string): ItemDef | undefined {
  return ITEM_CATALOG.find((i) => i.key === key);
}
