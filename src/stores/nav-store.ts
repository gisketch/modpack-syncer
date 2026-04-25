import { create } from "zustand";

export type View =
  | { kind: "packs" }
  | { kind: "pack"; id: string }
  | { kind: "settings" }
  | { kind: "about" }
  | { kind: "onboarding" };

type NavState = {
  view: View;
  go: (v: View) => void;
  back: () => void;
};

export const useNav = create<NavState>((set) => ({
  view: { kind: "packs" },
  go: (v) => set({ view: v }),
  back: () => set({ view: { kind: "packs" } }),
}));
