import "@testing-library/jest-dom/vitest";
import "@/i18n/test-setup";

if (typeof window !== "undefined" && typeof window.localStorage?.getItem !== "function") {
  const storage = new Map<string, string>();
  const localStorageShim = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    clear() {
      storage.clear();
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null;
    },
    get length() {
      return storage.size;
    },
  };

  Object.defineProperty(window, "localStorage", {
    value: localStorageShim,
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageShim,
    configurable: true,
  });
}
