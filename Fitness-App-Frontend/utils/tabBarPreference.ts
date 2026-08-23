import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "invicta.useNativeIosTabs";

let cachedPreference: boolean | undefined;
const listeners = new Set<(useNativeTabs: boolean) => void>();

export async function getUseNativeIosTabs(): Promise<boolean> {
  if (cachedPreference !== undefined) {
    return cachedPreference;
  }

  const storedValue = await AsyncStorage.getItem(STORAGE_KEY);
  cachedPreference = storedValue === null ? true : storedValue === "true";
  return cachedPreference;
}

export async function setUseNativeIosTabs(useNativeTabs: boolean): Promise<void> {
  cachedPreference = useNativeTabs;
  listeners.forEach((listener) => listener(useNativeTabs));
  await AsyncStorage.setItem(STORAGE_KEY, String(useNativeTabs));
}

export function subscribeToNativeIosTabs(listener: (useNativeTabs: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
