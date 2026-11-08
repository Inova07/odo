import { Preferences } from "@capacitor/preferences";

// Simple key/value storage. Uses the OS keystore on iOS/Android
// (UserDefaults / SharedPreferences) and localStorage on the web,
// so the same code runs everywhere. Data survives app restarts.
export const store = {
  async get(key) {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  },
  async set(key, value) {
    await Preferences.set({ key, value: String(value) });
  },
  async remove(key) {
    await Preferences.remove({ key });
  },
};
