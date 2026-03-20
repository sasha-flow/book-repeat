import assert from "node:assert/strict";
import test from "node:test";

const { getOpaqueHeaderSurfaceStyle } = (await import(
  new URL("./book-detail-styles.ts", import.meta.url).href
)) as typeof import("./book-detail-styles");

test("opaque book header surface uses a solid app background", () => {
  assert.deepEqual(getOpaqueHeaderSurfaceStyle(), {
    backgroundColor: "var(--background)",
    isolation: "isolate",
  });
});
