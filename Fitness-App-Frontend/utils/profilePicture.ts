import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "invicta_profile_picture_uri";

// Module-level broadcast so AskBar / Chatbot re-render immediately after the
// user updates their photo in the profile screen.
const _listeners = new Set<() => void>();

export async function saveProfilePicture(uri: string): Promise<void> {
  await AsyncStorage.setItem(KEY, uri);
  _listeners.forEach((fn) => fn());
}

export async function loadProfilePicture(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export function useProfilePicture(): string | null {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadProfilePicture().then((u) => { if (mounted) setUri(u); });
    const listener = () => {
      loadProfilePicture().then((u) => { if (mounted) setUri(u); });
    };
    _listeners.add(listener);
    return () => {
      mounted = false;
      _listeners.delete(listener);
    };
  }, []);

  return uri;
}
