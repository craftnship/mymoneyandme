"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage-backed state for per-visitor conveniences (number format, quick
 * check answers). Reads go through useSyncExternalStore so the server render and
 * the first client render agree on the fallback, avoiding hydration mismatches.
 */
const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

export function useStoredState<T>(key: string, fallback: T): [T, (next: T) => void] {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(cb);
      const onStorage = (e: StorageEvent) => { if (e.key === key) cb(); };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.get(key)!.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );
  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {}
  }
  const set = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      emit(key);
    },
    [key],
  );
  return [value, set];
}
