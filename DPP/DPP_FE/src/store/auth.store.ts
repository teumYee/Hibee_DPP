// Authentication store
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type OnboardingDraft = {
  goals: string[];
  active_time: string;
  night_mode_start: string;
  night_mode_end: string;
  checkin_time: string;
  checkin_window_minutes: number;
  day_rollover_time: string;
  struggles: string[];
  focus_categories: string[];
  categories: {
    packageName: string;
    appName: string;
    categoryId: number;
    categoryName: string;
  }[];
};

function emptyOnboardingDraft(): OnboardingDraft {
  return {
    goals: [],
    active_time: "",
    night_mode_start: "",
    night_mode_end: "",
    checkin_time: "21:00",
    checkin_window_minutes: 120,
    day_rollover_time: "21:00",
    struggles: [],
    focus_categories: [],
    categories: [],
  };
}

function parseOnboardingDraft(raw: string | null): OnboardingDraft {
  if (raw == null || raw === "") {
    return emptyOnboardingDraft();
  }
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) {
      return emptyOnboardingDraft();
    }
    const o = v as Record<string, unknown>;
    const goals = Array.isArray(o.goals)
      ? o.goals.filter((x): x is string => typeof x === "string")
      : [];
    const active_time =
      typeof o.active_time === "string" ? o.active_time : "";
    const night_mode_start =
      typeof o.night_mode_start === "string" ? o.night_mode_start : "";
    const night_mode_end =
      typeof o.night_mode_end === "string" ? o.night_mode_end : "";
    const checkin_time =
      typeof o.checkin_time === "string" ? o.checkin_time : "21:00";
    const checkin_window_minutes =
      typeof o.checkin_window_minutes === "number" && o.checkin_window_minutes > 0
        ? o.checkin_window_minutes
        : 120;
    const day_rollover_time =
      typeof o.day_rollover_time === "string" ? o.day_rollover_time : checkin_time;
    const struggles = Array.isArray(o.struggles)
      ? o.struggles.filter((x): x is string => typeof x === "string")
      : [];
    const focus_categories = Array.isArray(o.focus_categories)
      ? o.focus_categories.filter((x): x is string => typeof x === "string")
      : [];

    const categories = Array.isArray(o.categories)
      ? o.categories
          .map((it): OnboardingDraft["categories"][number] | null => {
            if (typeof it !== "object" || it === null) return null;
            const r = it as Record<string, unknown>;
            const packageName = r.packageName;
            const appName = r.appName;
            const categoryId = r.categoryId;
            const categoryName = r.categoryName;
            if (
              typeof packageName !== "string" ||
              typeof appName !== "string" ||
              typeof categoryId !== "number" ||
              typeof categoryName !== "string"
            ) {
              return null;
            }
            return { packageName, appName, categoryId, categoryName };
          })
          .filter(
            (
              x,
            ): x is OnboardingDraft["categories"][number] => x != null,
          )
      : [];
    return {
      goals,
      active_time,
      night_mode_start,
      night_mode_end,
      checkin_time,
      checkin_window_minutes,
      day_rollover_time,
      struggles,
      focus_categories,
      categories,
    };
  } catch {
    return emptyOnboardingDraft();
  }
}

type AuthState = {
  token: string | null;
  userId: number | null;
  onboardingDone: boolean;
  onboardingData: OnboardingDraft;

  isAuthed: boolean;
  hydrate: () => Promise<void>;

  setToken: (token: string | null) => Promise<void>;
  setUserId: (userId: number | null) => Promise<void>;
  setOnboardingDone: (done: boolean) => Promise<void>;
  setOnboardingData: (patch: Partial<OnboardingDraft>) => Promise<void>;
  replaceOnboardingData: (next: OnboardingDraft) => Promise<void>;
  logout: () => Promise<void>;
};

const KEY_TOKEN = "auth.token";
const KEY_USER_ID = "auth.userId";
const KEY_ONBOARD = "auth.onboardingDone";
const KEY_ONBOARDING_DATA = "auth.onboardingData";

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  userId: null,
  onboardingDone: false,
  onboardingData: emptyOnboardingDraft(),

  get isAuthed() {
    return !!get().token;
  },

  hydrate: async () => {
    const [token, userIdRaw, onboard, draftRaw] = await Promise.all([
      AsyncStorage.getItem(KEY_TOKEN),
      AsyncStorage.getItem(KEY_USER_ID),
      AsyncStorage.getItem(KEY_ONBOARD),
      AsyncStorage.getItem(KEY_ONBOARDING_DATA),
    ]);
    const parsedUserId =
      userIdRaw != null && !Number.isNaN(Number(userIdRaw))
        ? Number(userIdRaw)
        : null;

    set({
      token: token ?? null,
      userId: parsedUserId,
      onboardingDone: onboard === "1",
      onboardingData: parseOnboardingDraft(draftRaw),
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

  setOnboardingData: async (patch) => {
    const merged: OnboardingDraft = { ...get().onboardingData, ...patch };
    set({ onboardingData: merged });
    await AsyncStorage.setItem(KEY_ONBOARDING_DATA, JSON.stringify(merged));
  },

  replaceOnboardingData: async (next) => {
    set({ onboardingData: next });
    await AsyncStorage.setItem(KEY_ONBOARDING_DATA, JSON.stringify(next));
  },

  logout: async () => {
    await Promise.all([
      AsyncStorage.removeItem(KEY_TOKEN),
      AsyncStorage.removeItem(KEY_USER_ID),
      AsyncStorage.setItem(KEY_ONBOARD, "0"),
      AsyncStorage.removeItem(KEY_ONBOARDING_DATA),
    ]);
    set({
      token: null,
      userId: null,
      onboardingDone: false,
      onboardingData: emptyOnboardingDraft(),
    });
  },
}));
