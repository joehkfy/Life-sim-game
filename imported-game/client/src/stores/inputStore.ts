import { create } from "zustand";

interface InputState {
  mobileX: number;
  mobileZ: number;
  mobileRun: boolean;
  mobileJump: boolean;
  setMobileMove: (x: number, z: number) => void;
  setMobileRun: (r: boolean) => void;
  setMobileJump: (jumping: boolean) => void;
}

export const useInputStore = create<InputState>((set) => ({
  mobileX: 0,
  mobileZ: 0,
  mobileRun: false,
  mobileJump: false,
  setMobileMove: (x, z) => set({ mobileX: x, mobileZ: z }),
  setMobileRun: (r) => set({ mobileRun: r }),
  setMobileJump: (jumping) => set({ mobileJump: jumping }),
}));
