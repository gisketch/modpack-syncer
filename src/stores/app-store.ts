import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  adminModeByPack: Record<string, boolean>;
  setActiveProfile: (name: string | null) => void;
  setPackAdminMode: (packId: string, adminMode: boolean) => void;
  isPackAdminMode: (packId: string) => boolean;
  addPack: (pack: Pack) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      packs: [],
      profiles: [],
      activeProfile: null,
      adminModeByPack: {},
      setActiveProfile: (name) => set({ activeProfile: name }),
      setPackAdminMode: (packId, adminMode) =>
        set((state) => ({
          adminModeByPack: {
            ...state.adminModeByPack,
            [packId]: adminMode,
          },
        })),
      isPackAdminMode: (packId) => get().adminModeByPack[packId] ?? false,
      addPack: (pack) => set((s) => ({ packs: [...s.packs, pack] })),
    }),
    {
      name: "modsync-app-store",
      partialize: (state) => ({
        activeProfile: state.activeProfile,
        adminModeByPack: state.adminModeByPack,
      }),
    },
  ),
);
