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
  adminMode: boolean;
  setActiveProfile: (name: string | null) => void;
  setAdminMode: (adminMode: boolean) => void;
  addPack: (pack: Pack) => void;
};

export const useAppStore = create<AppState>((set) => ({
  packs: [],
  profiles: [],
  activeProfile: null,
  adminMode: false,
  setActiveProfile: (name) => set({ activeProfile: name }),
  setAdminMode: (adminMode) => set({ adminMode }),
  addPack: (pack) => set((s) => ({ packs: [...s.packs, pack] })),
}));
