import assert from "node:assert/strict";
import test from "node:test";

const { deriveKeyboardViewportState, KEYBOARD_VIEWPORT_THRESHOLD_PX } =
  (await import(
    new URL("./keyboard-viewport.ts", import.meta.url).href
  )) as typeof import("./keyboard-viewport");

test("small visual viewport changes do not count as an open keyboard", () => {
  assert.deepEqual(
    deriveKeyboardViewportState({
      layoutViewportHeight: 844,
      visualViewportHeight: 780,
      visualViewportOffsetTop: 0,
      editableFocused: true,
    }),
    {
      keyboardOpen: false,
      viewportHeight: 844,
      bottomInset: 0,
    },
  );
});

test("large viewport reduction with an active editable field opens keyboard mode", () => {
  assert.equal(KEYBOARD_VIEWPORT_THRESHOLD_PX > 100, true);

  assert.deepEqual(
    deriveKeyboardViewportState({
      layoutViewportHeight: 844,
      visualViewportHeight: 512,
      visualViewportOffsetTop: 0,
      editableFocused: true,
    }),
    {
      keyboardOpen: true,
      viewportHeight: 512,
      bottomInset: 332,
    },
  );
});

test("keyboard mode closes when no editable element is focused", () => {
  assert.deepEqual(
    deriveKeyboardViewportState({
      layoutViewportHeight: 844,
      visualViewportHeight: 512,
      visualViewportOffsetTop: 0,
      editableFocused: false,
    }),
    {
      keyboardOpen: false,
      viewportHeight: 844,
      bottomInset: 0,
    },
  );
});
