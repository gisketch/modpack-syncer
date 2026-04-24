import { create } from "zustand";

type Pack = {
  id: string;
  name: string;
  remote: string; // github url
  localPath: string;
  headSha: string | null;
};

type Profile = {
  name: string;
  packId: string;
  prismInstanceName: string;
};

type AppState = {
  packs: Pack[];
  profiles: Profile[];
  activeProfile: string | null;
  setActiveProfile: (name: string | null) => void;
  addPack: (pack: Pack) => void;
};

export const useAppStore = create<AppState>((set) => ({
  packs: [],
  profiles: [],
  activeProfile: null,
  setActiveProfile: (name) => set({ activeProfile: name }),
  addPack: (pack) => set((s) => ({ packs: [...s.packs, pack] })),
}));
