"use client";

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import {
  getStoredThemePreference,
  isThemePreference,
  resolveTheme,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "../lib/theme";

interface ThemeContextValue {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  mounted: boolean;
  setThemePreference: (themePreference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemPrefersDark(): boolean {
  return typeof window !== "undefined"
    ? window.matchMedia(THEME_MEDIA_QUERY).matches
    : false;
}

function getThemePreferenceFromDocument(): ThemePreference | null {
  if (typeof document === "undefined") {
    return null;
  }

  const themePreference = document.documentElement.dataset.themePreference;

  return isThemePreference(themePreference) ? themePreference : null;
}

function getResolvedThemeFromDocument(): ResolvedTheme | null {
  if (typeof document === "undefined") {
    return null;
  }

  const resolvedTheme = document.documentElement.dataset.resolvedTheme;

  return resolvedTheme === "light" || resolvedTheme === "dark"
    ? resolvedTheme
    : null;
}

function getInitialThemePreference(): ThemePreference {
  const documentTheme = getThemePreferenceFromDocument();

  if (documentTheme) {
    return documentTheme;
  }

  if (typeof window === "undefined") {
    return "system";
  }

  return getStoredThemePreference(
    window.localStorage.getItem(THEME_STORAGE_KEY),
  );
}

function applyTheme(themePreference: ThemePreference): ResolvedTheme {
  const resolvedTheme = resolveTheme(themePreference, getSystemPrefersDark());

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.dataset.themePreference = themePreference;
    root.dataset.resolvedTheme = resolvedTheme;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  }

  return resolvedTheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    getInitialThemePreference,
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const documentTheme = getResolvedThemeFromDocument();

    if (documentTheme) {
      return documentTheme;
    }

    return resolveTheme(getInitialThemePreference(), getSystemPrefersDark());
  });
  const [mounted, setMounted] = useState(false);

  const syncTheme = useEffectEvent((nextThemePreference: ThemePreference) => {
    const nextResolvedTheme = applyTheme(nextThemePreference);

    setResolvedTheme(nextResolvedTheme);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextThemePreference);
      } catch {
        // Ignore storage failures and keep the in-memory preference active.
      }
    }
  });

  useEffect(() => {
    setMounted(true);
    syncTheme(themePreference);

    if (typeof window === "undefined" || themePreference !== "system") {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(THEME_MEDIA_QUERY);

    const handleThemeChange = () => {
      const nextResolvedTheme = applyTheme("system");
      setResolvedTheme(nextResolvedTheme);
    };

    mediaQueryList.addEventListener("change", handleThemeChange);

    return () => {
      mediaQueryList.removeEventListener("change", handleThemeChange);
    };
  }, [syncTheme, themePreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      mounted,
      setThemePreference: setThemePreferenceState,
    }),
    [mounted, resolvedTheme, themePreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
