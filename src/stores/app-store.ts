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
  lastSyncedCommitByPack: Record<string, string>;
  selectedOptionPresetByPack: Record<string, string>;
  skipLaunchPresetSelectionByPack: Record<string, boolean>;
  publishIgnorePatternsByPack: Record<string, string[]>;
  disabledArtifactsByPack: Record<string, Record<string, string[]>>;
  setActiveProfile: (name: string | null) => void;
  setPackAdminMode: (packId: string, adminMode: boolean) => void;
  setLastSyncedCommit: (packId: string, commitSha: string) => void;
  setSelectedOptionPreset: (packId: string, presetId: string) => void;
  setSkipLaunchPresetSelection: (packId: string, skip: boolean) => void;
  setPublishIgnorePatterns: (packId: string, patterns: string[]) => void;
  setArtifactDisabled: (
    packId: string,
    category: string,
    filename: string,
    disabled: boolean,
  ) => void;
  setPackDisabledArtifacts: (packId: string, disabledArtifacts: Record<string, string[]>) => void;
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
      lastSyncedCommitByPack: {},
      selectedOptionPresetByPack: {},
      skipLaunchPresetSelectionByPack: {},
      publishIgnorePatternsByPack: {},
      disabledArtifactsByPack: {},
      setActiveProfile: (name) => set({ activeProfile: name }),
      setPackAdminMode: (packId, adminMode) =>
        set((state) => ({
          adminModeByPack: {
            ...state.adminModeByPack,
            [packId]: adminMode,
          },
        })),
      setLastSyncedCommit: (packId, commitSha) =>
        set((state) => ({
          lastSyncedCommitByPack: {
            ...state.lastSyncedCommitByPack,
            [packId]: commitSha,
          },
        })),
      setSelectedOptionPreset: (packId, presetId) =>
        set((state) => ({
          selectedOptionPresetByPack: {
            ...state.selectedOptionPresetByPack,
            [packId]: presetId,
          },
        })),
      setSkipLaunchPresetSelection: (packId, skip) =>
        set((state) => ({
          skipLaunchPresetSelectionByPack: {
            ...state.skipLaunchPresetSelectionByPack,
            [packId]: skip,
          },
        })),
      setPublishIgnorePatterns: (packId, patterns) =>
        set((state) => ({
          publishIgnorePatternsByPack: {
            ...state.publishIgnorePatternsByPack,
            [packId]: patterns,
          },
        })),
      setArtifactDisabled: (packId, category, filename, disabled) =>
        set((state) => {
          const packDisabled = state.disabledArtifactsByPack[packId] ?? {};
          const categoryDisabled = new Set(packDisabled[category] ?? []);
          if (disabled) {
            categoryDisabled.add(filename);
          } else {
            categoryDisabled.delete(filename);
          }
          return {
            disabledArtifactsByPack: {
              ...state.disabledArtifactsByPack,
              [packId]: {
                ...packDisabled,
                [category]: [...categoryDisabled],
              },
            },
          };
        }),
      setPackDisabledArtifacts: (packId, disabledArtifacts) =>
        set((state) => ({
          disabledArtifactsByPack: {
            ...state.disabledArtifactsByPack,
            [packId]: disabledArtifacts,
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
        lastSyncedCommitByPack: state.lastSyncedCommitByPack,
        selectedOptionPresetByPack: state.selectedOptionPresetByPack,
        skipLaunchPresetSelectionByPack: state.skipLaunchPresetSelectionByPack,
        publishIgnorePatternsByPack: state.publishIgnorePatternsByPack,
        disabledArtifactsByPack: state.disabledArtifactsByPack,
      }),
    },
  ),
);
