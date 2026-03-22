import type { CSSProperties } from "react";

export function getBookmarkContextMenuLayout() {
  return {
    backdropClassName: "fixed inset-0 z-40 bg-black/50",
    railClassName: "fixed inset-x-0 bottom-0 z-50",
    overlayStyle: {
      pointerEvents: "none" as const,
    } satisfies CSSProperties,
    frameClassName: "mx-auto w-full",
    frameStyle: {
      maxWidth: 393.256,
    } satisfies CSSProperties,
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
    } satisfies CSSProperties,
  };
}