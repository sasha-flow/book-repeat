export type AppShellChromeMode = "flow" | "pinned";
export type AppShellBottomBarPlacement = "bottom" | "top";

export function getAppShellLayoutMetrics({
  chromeMode,
  hasBottomBar,
  keyboardOpen = false,
}: {
  chromeMode: AppShellChromeMode;
  hasBottomBar: boolean;
  keyboardOpen?: boolean;
}) {
  if (chromeMode === "pinned") {
    if (keyboardOpen) {
      return {
        headerClassName: "fixed top-0 left-0 right-0 z-20",
        navClassName: "hidden",
        bottomBarClassName: hasBottomBar
          ? "fixed top-0 left-0 right-0 z-20"
          : "hidden",
        bottomBarPlacement: hasBottomBar
          ? ("top" as const)
          : ("bottom" as const),
        mainClassName: "flex-1 px-4 py-3",
        mainStyle: undefined,
        chromeSurfaceStyle: {
          backgroundColor: "var(--background)",
          isolation: "isolate" as const,
        },
        needsHeaderSpacer: true,
        needsTopBottomBarSpacer: hasBottomBar,
        needsBottomBarSpacer: false,
        needsNavSpacer: false,
      };
    }

    return {
      headerClassName: "fixed top-0 left-0 right-0 z-20",
      navClassName: "fixed bottom-0 left-0 right-0 z-20",
      bottomBarClassName: "fixed bottom-[65.098px] left-0 right-0 z-20",
      bottomBarPlacement: "bottom" as const,
      mainClassName: "flex-1 px-4 py-3",
      mainStyle: undefined,
      chromeSurfaceStyle: {
        backgroundColor: "var(--background)",
        isolation: "isolate" as const,
      },
      needsHeaderSpacer: true,
      needsTopBottomBarSpacer: false,
      needsBottomBarSpacer: hasBottomBar,
      needsNavSpacer: true,
    };
  }

  return {
    headerClassName: "sticky top-0 z-20",
    navClassName: "sticky bottom-0 z-20 mt-auto",
    bottomBarClassName: "sticky bottom-[65.098px] z-20 mt-auto",
    bottomBarPlacement: "bottom" as const,
    mainClassName: "flex-1",
    mainStyle: {
      paddingLeft: 15.993,
      paddingRight: 15.993,
      paddingTop: 23.99,
      paddingBottom: hasBottomBar ? 134.177 : 65.098,
    },
    chromeSurfaceStyle: undefined,
    needsHeaderSpacer: false,
    needsTopBottomBarSpacer: false,
    needsBottomBarSpacer: false,
    needsNavSpacer: false,
  };
}
