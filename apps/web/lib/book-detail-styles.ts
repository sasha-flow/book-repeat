export function getOpaqueHeaderSurfaceStyle() {
  return {
    backgroundColor: "var(--background)",
    isolation: "isolate" as const,
  };
}
