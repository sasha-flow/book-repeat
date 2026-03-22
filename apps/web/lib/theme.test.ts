import assert from "node:assert/strict";
import test from "node:test";

const {
  getStoredThemePreference,
  isThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} = (await import(
  new URL("./theme.ts", import.meta.url).href
)) as typeof import("./theme");

test("THEME_STORAGE_KEY stays stable for browser persistence", () => {
  assert.equal(THEME_STORAGE_KEY, "book-repeat-theme");
});

test("isThemePreference accepts only light, dark, and system", () => {
  assert.equal(isThemePreference("light"), true);
  assert.equal(isThemePreference("dark"), true);
  assert.equal(isThemePreference("system"), true);
  assert.equal(isThemePreference("other"), false);
  assert.equal(isThemePreference(null), false);
});

test("getStoredThemePreference falls back to system for unknown values", () => {
  assert.equal(getStoredThemePreference("light"), "light");
  assert.equal(getStoredThemePreference("dark"), "dark");
  assert.equal(getStoredThemePreference("system"), "system");
  assert.equal(getStoredThemePreference("unexpected"), "system");
  assert.equal(getStoredThemePreference(null), "system");
});

test("resolveTheme uses system preference only when requested", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});
