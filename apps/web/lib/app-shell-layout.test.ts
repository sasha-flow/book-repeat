import assert from "node:assert/strict";
import test from "node:test";

const { getAppShellLayoutMetrics } = (await import(
  new URL("./app-shell-layout.ts", import.meta.url).href
)) as typeof import("./app-shell-layout");

test("pinned shell chrome reserves space for a bottom bar without rendering bottom navigation", () => {
  assert.deepEqual(
    getAppShellLayoutMetrics({ chromeMode: "pinned", hasBottomBar: true }),
    {
      headerClassName: "fixed top-0 left-0 right-0 z-20",
      navClassName: "hidden",
      bottomBarClassName: "fixed bottom-0 left-0 right-0 z-20",
      bottomBarPlacement: "bottom",
      mainClassName: "flex-1 px-4 py-3",
      mainStyle: undefined,
      chromeSurfaceStyle: {
        backgroundColor: "var(--background)",
        isolation: "isolate",
      },
      needsHeaderSpacer: true,
      needsTopBottomBarSpacer: false,
      needsBottomBarSpacer: true,
      needsNavSpacer: false,
    },
  );
});

test("flow shell chrome keeps content spacing inside main area", () => {
  assert.deepEqual(
    getAppShellLayoutMetrics({ chromeMode: "flow", hasBottomBar: false }),
    {
      headerClassName: "sticky top-0 z-20",
      navClassName: "hidden",
      bottomBarClassName: "sticky bottom-[65.098px] z-20 mt-auto",
      bottomBarPlacement: "bottom",
      mainClassName: "flex-1",
      mainStyle: {
        paddingLeft: 15.993,
        paddingRight: 15.993,
        paddingTop: 23.99,
        paddingBottom: 0,
      },
      chromeSurfaceStyle: undefined,
      needsHeaderSpacer: false,
      needsTopBottomBarSpacer: false,
      needsBottomBarSpacer: false,
      needsNavSpacer: false,
    },
  );
});

test("pinned shell yields bottom nav space and moves search chrome to the top while keyboard is open", () => {
  assert.deepEqual(
    getAppShellLayoutMetrics({
      chromeMode: "pinned",
      hasBottomBar: true,
      keyboardOpen: true,
    }),
    {
      headerClassName: "fixed top-0 left-0 right-0 z-20",
      navClassName: "hidden",
      bottomBarClassName: "fixed top-0 left-0 right-0 z-20",
      bottomBarPlacement: "top",
      mainClassName: "flex-1 px-4 py-3",
      mainStyle: undefined,
      chromeSurfaceStyle: {
        backgroundColor: "var(--background)",
        isolation: "isolate",
      },
      needsHeaderSpacer: true,
      needsTopBottomBarSpacer: true,
      needsBottomBarSpacer: false,
      needsNavSpacer: false,
    },
  );
});

test("pinned shell without a bottom bar keeps only the header chrome", () => {
  assert.deepEqual(
    getAppShellLayoutMetrics({ chromeMode: "pinned", hasBottomBar: false }),
    {
      headerClassName: "fixed top-0 left-0 right-0 z-20",
      navClassName: "hidden",
      bottomBarClassName: "hidden",
      bottomBarPlacement: "bottom",
      mainClassName: "flex-1 px-4 py-3",
      mainStyle: undefined,
      chromeSurfaceStyle: {
        backgroundColor: "var(--background)",
        isolation: "isolate",
      },
      needsHeaderSpacer: true,
      needsTopBottomBarSpacer: false,
      needsBottomBarSpacer: false,
      needsNavSpacer: false,
    },
  );
});
