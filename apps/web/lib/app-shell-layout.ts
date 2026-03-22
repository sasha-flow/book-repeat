export type AppShellChromeMode = "flow" | "pinned";

export function getAppShellLayoutMetrics({
  chromeMode,
  hasBottomBar,
}: {
  chromeMode: AppShellChromeMode;
  hasBottomBar: boolean;
}) {
  if (chromeMode === "pinned") {
    return {
      headerClassName: "fixed top-0 left-0 right-0 z-20",
      navClassName: "fixed bottom-0 left-0 right-0 z-20",
      bottomBarClassName: "fixed bottom-[65.098px] left-0 right-0 z-20",
      mainClassName: "flex-1 px-4 py-3",
      mainStyle: undefined,
      chromeSurfaceStyle: {
        backgroundColor: "var(--background)",
        isolation: "isolate" as const,
      },
      needsHeaderSpacer: true,
      needsBottomBarSpacer: hasBottomBar,
      needsNavSpacer: true,
    };
  }

  return {
    headerClassName: "sticky top-0 z-20",
    navClassName: "sticky bottom-0 z-20 mt-auto",
    bottomBarClassName: "sticky bottom-[65.098px] z-20 mt-auto",
    mainClassName: "flex-1",
    mainStyle: {
      paddingLeft: 15.993,
      paddingRight: 15.993,
      paddingTop: 23.99,
      paddingBottom: hasBottomBar ? 134.177 : 65.098,
    },
    chromeSurfaceStyle: undefined,
    needsHeaderSpacer: false,
    needsBottomBarSpacer: false,
    needsNavSpacer: false,
  };
}
