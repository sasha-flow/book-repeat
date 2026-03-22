export const THEME_STORAGE_KEY = "book-repeat-theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function getStoredThemePreference(
  value: string | null | undefined,
): ThemePreference {
  return isThemePreference(value) ? value : "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  return preference;
}

export function getThemeInitScript(): string {
  return `(() => {
    const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
    const mediaQuery = ${JSON.stringify(THEME_MEDIA_QUERY)};
    const root = document.documentElement;

    const resolveStoredPreference = (value) =>
      value === "light" || value === "dark" || value === "system"
        ? value
        : "system";

    try {
      const storedPreference = resolveStoredPreference(
        window.localStorage.getItem(storageKey),
      );
      const resolvedTheme =
        storedPreference === "system"
          ? window.matchMedia(mediaQuery).matches
            ? "dark"
            : "light"
          : storedPreference;

      root.dataset.themePreference = storedPreference;
      root.dataset.resolvedTheme = resolvedTheme;
      root.classList.toggle("dark", resolvedTheme === "dark");
      root.style.colorScheme = resolvedTheme;
    } catch {
      const resolvedTheme = window.matchMedia(mediaQuery).matches
        ? "dark"
        : "light";

      root.dataset.themePreference = "system";
      root.dataset.resolvedTheme = resolvedTheme;
      root.classList.toggle("dark", resolvedTheme === "dark");
      root.style.colorScheme = resolvedTheme;
    }
  })();`;
}
