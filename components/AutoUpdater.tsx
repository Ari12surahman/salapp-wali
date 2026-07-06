import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import * as Updates from "expo-updates";

export default function AutoUpdater() {
  const initialVersion = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
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
              
              // 1. Tell ServiceWorker to skipWaiting
              if ('serviceWorker' in navigator) {
                try {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  for (let reg of regs) {
                    if (reg.waiting) {
                      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                    reg.update();
                  }
                } catch (err) {
                  console.warn("[AutoUpdater] SW update failed", err);
                }
              }

              // 2. Clear browser caches for the PWA
              if ('caches' in window) {
                try {
                  const cacheNames = await caches.keys();
                  await Promise.all(cacheNames.map(name => caches.delete(name)));
                  console.log("[AutoUpdater] Caches cleared.");
                } catch (err) {
                  console.warn("[AutoUpdater] Cache clear failed", err);
                }
              }

              // 3. Reload app
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            }
          }
        } catch (e) {
          console.warn("[AutoUpdater] Failed to check version", e);
        }
      };

      checkVersion();
      const subscription = AppState.addEventListener("change", (nextAppState) => {
        if (nextAppState === "active") checkVersion();
      });
      const interval = setInterval(checkVersion, 15 * 60 * 1000);
      return () => {
        subscription.remove();
        clearInterval(interval);
      };
    } else {
      const checkExpoUpdate = async () => {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            console.log("[AutoUpdater] New OTA update available! Fetching...");
            await Updates.fetchUpdateAsync();
            console.log("[AutoUpdater] OTA update fetched! Reloading app...");
            await Updates.reloadAsync();
          }
        } catch (e) {
          console.log("Failed to check for expo update:", e);
        }
      };

      if (!__DEV__) {
        checkExpoUpdate();
        const subscription = AppState.addEventListener("change", (nextAppState) => {
          if (nextAppState === "active") checkExpoUpdate();
        });
        const interval = setInterval(checkExpoUpdate, 15 * 60 * 1000);
        return () => {
          subscription.remove();
          clearInterval(interval);
        };
      }
    }
  }, []);

  return null;
}
