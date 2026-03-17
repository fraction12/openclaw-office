import type { StateCreator } from "zustand";
import type { OfficeStore } from "@/gateway/types";
import { CHAT_DOCK_HEIGHT_KEY, getInitialBloom, getInitialChatDockHeight, getInitialTheme, THEME_STORAGE_KEY } from "./store-helpers";

export const createOfficeUiSlice: StateCreator<OfficeStore, [["zustand/immer", never]], [], Partial<OfficeStore>> =
(set) => ({
  connectionStatus: "disconnected",
  connectionError: null,
  viewMode: "2d",
  sidebarCollapsed: false,
  theme: getInitialTheme(),
  bloomEnabled: getInitialBloom(),
  currentPage: "office",
  chatDockHeight: getInitialChatDockHeight(),
  operatorScopes: [],
  lastSessionsSnapshot: null,
  maxSubAgents: 8,
  agentToAgentConfig: { enabled: false, allow: [] },

  setViewMode: (mode) => set((state) => { state.viewMode = mode; }),
  setConnectionStatus: (status, error) => set((state) => {
    state.connectionStatus = status;
    state.connectionError = error ?? null;
  }),
  setSidebarCollapsed: (collapsed) => set((state) => { state.sidebarCollapsed = collapsed; }),
  setTheme: (theme) => {
    set((state) => { state.theme = theme; });
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
  },
  setBloomEnabled: (enabled) => set((state) => { state.bloomEnabled = enabled; }),
  setOperatorScopes: (scopes) => set((state) => { state.operatorScopes = scopes; }),
  setSessionsSnapshot: (snapshot) => set((state) => { state.lastSessionsSnapshot = snapshot; }),
  setCurrentPage: (page) => set((state) => { state.currentPage = page; }),
  setChatDockHeight: (height) => {
    set((state) => { state.chatDockHeight = height; });
    try { localStorage.setItem(CHAT_DOCK_HEIGHT_KEY, String(height)); } catch {}
  },
  setAgentToAgentConfig: (config) => set((state) => { state.agentToAgentConfig = config; }),
});
