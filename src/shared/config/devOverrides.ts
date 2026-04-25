import { create } from 'zustand'
import * as FileSystem from 'expo-file-system/legacy'
import Constants from 'expo-constants'

const IS_DEV = Constants.expoConfig?.extra?.isDev === true
const OVERRIDES_PATH = (FileSystem.documentDirectory ?? '') + 'dev-overrides.json'

type DevOverridesState = {
  threshold: number | null
  padding: number | null
  setThreshold: (v: number | null) => void
  setPadding: (v: number | null) => void
  resetAll: () => void
  load: () => Promise<void>
}

async function persist(data: { threshold: number | null; padding: number | null }) {
  await FileSystem.writeAsStringAsync(OVERRIDES_PATH, JSON.stringify(data))
}

export const useDevOverrides = create<DevOverridesState>((set, get) => ({
  threshold: null,
  padding: null,

  setThreshold: (v) => {
    set({ threshold: v })
    if (IS_DEV) persist({ threshold: v, padding: get().padding })
  },

  setPadding: (v) => {
    set({ padding: v })
    if (IS_DEV) persist({ threshold: get().threshold, padding: v })
  },

  resetAll: () => {
    set({ threshold: null, padding: null })
    if (IS_DEV) persist({ threshold: null, padding: null })
  },

  load: async () => {
    if (!IS_DEV) return
    try {
      const content = await FileSystem.readAsStringAsync(OVERRIDES_PATH)
      const data = JSON.parse(content) as { threshold?: unknown; padding?: unknown }
      set({
        threshold: typeof data.threshold === 'number' ? data.threshold : null,
        padding: typeof data.padding === 'number' ? data.padding : null,
      })
    } catch {
      // ファイル未作成の初回起動は正常ケース
    }
  },
}))
