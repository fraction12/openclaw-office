import { create } from "zustand";
import { getAdapterOrThrow } from "@/gateway/adapter-provider";
import type { ChannelInfo, ChannelType } from "@/gateway/adapter-types";

export type QrState = "idle" | "loading" | "qr" | "scanning" | "success" | "error" | "cancel";

interface ChannelsStoreState {
  channels: ChannelInfo[];
  isLoading: boolean;
  error: string | null;

  selectedChannel: ChannelInfo | null;
  configDialogOpen: boolean;
  configDialogChannelType: ChannelType | null;
  qrState: QrState;
  qrDataUrl: string | null;
  qrError: string | null;

  fetchChannels: () => Promise<void>;
  logoutChannel: (channel: string, accountId?: string) => Promise<void>;
  openConfigDialog: (channelType: ChannelType, existingChannel?: ChannelInfo) => void;
  closeConfigDialog: () => void;
  startQrPairing: () => Promise<void>;
  cancelQrPairing: () => void;
}

export const useChannelsStore = create<ChannelsStoreState>((set, get) => ({
  channels: [],
  isLoading: false,
  error: null,

  selectedChannel: null,
  configDialogOpen: false,
  configDialogChannelType: null,
  qrState: "idle",
  qrDataUrl: null,
  qrError: null,

  fetchChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      getAdapterOrThrow();
      const channels = await getAdapterOrThrow().channelsStatus();
      set({ channels, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  logoutChannel: async (channel, accountId) => {
    try {
      await getAdapterOrThrow().channelsLogout(channel, accountId);
      await get().fetchChannels();
    } catch (err) {
      set({ error: String(err) });
    }
  },

  openConfigDialog: (channelType, existingChannel) => {
    set({
      configDialogOpen: true,
      configDialogChannelType: channelType,
      selectedChannel: existingChannel ?? null,
      qrState: "idle",
      qrDataUrl: null,
      qrError: null,
    });
  },

  closeConfigDialog: () => {
    set({
      configDialogOpen: false,
      configDialogChannelType: null,
      selectedChannel: null,
      qrState: "idle",
      qrDataUrl: null,
      qrError: null,
    });
  },

  startQrPairing: async () => {
    set({ qrState: "loading", qrError: null });
    try {
      const result = await getAdapterOrThrow().webLoginStart(true);
      set({ qrState: "qr", qrDataUrl: result.qrDataUrl ?? null });

      set({ qrState: "scanning" });
      const waitResult = await getAdapterOrThrow().webLoginWait();
      if (waitResult.connected) {
        set({ qrState: "success" });
        await get().fetchChannels();
      } else {
        set({ qrState: "error", qrError: waitResult.message });
      }
    } catch (err) {
      set({ qrState: "error", qrError: String(err) });
    }
  },

  cancelQrPairing: () => {
    set({ qrState: "idle", qrDataUrl: null, qrError: null });
  },
}));
