import assert from "node:assert/strict";
import test from "node:test";

const { getMobilePageHeaderLayout } = (await import(
  new URL("./mobile-page-header.ts", import.meta.url).href
)) as typeof import("./mobile-page-header");

test("mobile page header layout matches the bookmark header geometry", () => {
  assert.deepEqual(getMobilePageHeaderLayout(), {
    headerHeight: 65.081,
    actionInsetX: 15.993,
    actionInsetTop: 12,
    actionSize: 39.983,
    titleInsetX: 55.98,
    titleInsetTop: 17,
    titleHeight: 30,
    borderBottomWidth: 1.108,
  });
});
