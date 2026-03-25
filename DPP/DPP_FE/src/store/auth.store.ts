// Authentication store
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

type AuthState = {
  token: string | null;
  userId: number | null;
  onboardingDone: boolean;

  isAuthed: boolean;
  hydrate: () => Promise<void>;

  setToken: (token: string | null) => Promise<void>;
  setUserId: (userId: number | null) => Promise<void>;
  setOnboardingDone: (done: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

const KEY_TOKEN = "auth.token";
const KEY_USER_ID = "auth.userId";
const KEY_ONBOARD = "auth.onboardingDone";

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  userId: null,
  onboardingDone: false,

  get isAuthed() {
    return !!get().token;
  },

  hydrate: async () => {
    const [token, userIdRaw, onboard] = await Promise.all([
      AsyncStorage.getItem(KEY_TOKEN),
      AsyncStorage.getItem(KEY_USER_ID),
      AsyncStorage.getItem(KEY_ONBOARD),
    ]);
    const parsedUserId =
      userIdRaw != null && !Number.isNaN(Number(userIdRaw))
        ? Number(userIdRaw)
        : null;

    set({
      token: token ?? null,
      userId: parsedUserId,
      onboardingDone: onboard === "1",
    });
  },

  setToken: async (token) => {
    if (token) await AsyncStorage.setItem(KEY_TOKEN, token);
    else await AsyncStorage.removeItem(KEY_TOKEN);
    set({ token });
  },

  setUserId: async (userId) => {
    if (userId != null) await AsyncStorage.setItem(KEY_USER_ID, String(userId));
    else await AsyncStorage.removeItem(KEY_USER_ID);
    set({ userId });
  },

  setOnboardingDone: async (done) => {
    await AsyncStorage.setItem(KEY_ONBOARD, done ? "1" : "0");
    set({ onboardingDone: done });
  },

  logout: async () => {
    await Promise.all([
      AsyncStorage.removeItem(KEY_TOKEN),
      AsyncStorage.removeItem(KEY_USER_ID),
      AsyncStorage.setItem(KEY_ONBOARD, "0"),
    ]);
    set({ token: null, userId: null, onboardingDone: false });
  },
}));
