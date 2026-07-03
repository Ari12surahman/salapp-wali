import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

export default function AutoUpdater() {
  const initialVersion = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (!data || !data.version) return;
        
        if (!initialVersion.current) {
          initialVersion.current = data.version;
        } else {
          if (initialVersion.current !== data.version) {
            console.log(`[AutoUpdater] New version detected (${data.version}), reloading...`);
            // Give a tiny delay for smooth experience
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        }
      } catch (e) {
        console.warn("[AutoUpdater] Failed to check version", e);
      }
    };

    // Check on mount
    checkVersion();

    // Check on app state change (foregrounding)
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        checkVersion();
      }
    });

    // Also check every 15 mins
    const interval = setInterval(checkVersion, 15 * 60 * 1000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  return null;
}
