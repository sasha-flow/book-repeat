import assert from "node:assert/strict";
import test from "node:test";

const { getBookmarkContextMenuLayout } = (await import(
  new URL("./bookmark-context-menu-styles.ts", import.meta.url).href
)) as typeof import("./bookmark-context-menu-styles");

test("bookmark context menu aligns its sheet with the reader content column", () => {
  assert.deepEqual(getBookmarkContextMenuLayout(), {
    backdropClassName: "fixed inset-0 z-40 bg-black/50",
    railClassName: "fixed inset-x-0 bottom-0 z-50",
    overlayStyle: {
      pointerEvents: "none",
    },
    frameClassName: "mx-auto w-full",
    frameStyle: {
      maxWidth: 393.256,
    },
    surfaceClassName: "pointer-events-auto w-full bg-background",
    surfaceStyle: {
      minHeight: 281.978,
      borderTopWidth: 1.108,
      borderTopStyle: "solid",
      borderTopColor: "var(--border)",
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      boxShadow: "0 -10px 30px rgba(3, 2, 19, 0.08)",
      backgroundColor: "var(--background)",
    },
  });
});