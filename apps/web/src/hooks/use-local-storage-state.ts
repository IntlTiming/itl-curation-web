import { useCallback, useState } from 'react';

// Generalizes theme-provider.tsx's lazy-init-read + write-through-setter localStorage
// pattern for any JSON-serializable state (e.g. Reviews table column visibility).
export function useLocalStorageState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // localStorage unavailable (private browsing, quota, etc.) - state still updates
          // in memory for this session, it just won't persist.
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set] as const;
}
