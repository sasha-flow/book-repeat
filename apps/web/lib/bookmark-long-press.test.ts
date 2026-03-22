import assert from "node:assert/strict";
import test from "node:test";

const {
  BOOKMARK_LONG_PRESS_DELAY_MS,
  BOOKMARK_LONG_PRESS_MOVE_TOLERANCE_PX,
  createBookmarkLongPressGesture,
  shouldCancelBookmarkLongPress,
} = (await import(
  new URL("./bookmark-long-press.ts", import.meta.url).href
)) as typeof import("./bookmark-long-press");

test("bookmark long press keeps a single stationary touch eligible", () => {
  const gesture = createBookmarkLongPressGesture([
    { identifier: 7, clientX: 120, clientY: 240 },
  ]);

  assert.deepEqual(gesture, {
    touchId: 7,
    startX: 120,
    startY: 240,
  });
  assert.equal(
    shouldCancelBookmarkLongPress(gesture, [
      { identifier: 7, clientX: 126, clientY: 247 },
    ]),
    false,
  );
});

test("bookmark long press cancels once touch movement exceeds the tolerance", () => {
  const gesture = createBookmarkLongPressGesture([
    { identifier: 3, clientX: 10, clientY: 10 },
  ]);

  assert.equal(
    shouldCancelBookmarkLongPress(gesture, [
      {
        identifier: 3,
        clientX: 10 + BOOKMARK_LONG_PRESS_MOVE_TOLERANCE_PX + 1,
        clientY: 10,
      },
    ]),
    true,
  );
});

test("bookmark long press cancels for multi-touch or missing active touch", () => {
  const gesture = createBookmarkLongPressGesture([
    { identifier: 11, clientX: 50, clientY: 70 },
  ]);

  assert.equal(
    shouldCancelBookmarkLongPress(gesture, [
      { identifier: 11, clientX: 50, clientY: 70 },
      { identifier: 12, clientX: 51, clientY: 71 },
    ]),
    true,
  );
  assert.equal(shouldCancelBookmarkLongPress(gesture, []), true);
});

test("bookmark long press requires exactly one touch to start", () => {
  assert.equal(createBookmarkLongPressGesture([]), null);
  assert.equal(
    createBookmarkLongPressGesture([
      { identifier: 1, clientX: 10, clientY: 10 },
      { identifier: 2, clientX: 20, clientY: 20 },
    ]),
    null,
  );
});

test("bookmark long press delay stays at the mobile hold default", () => {
  assert.equal(BOOKMARK_LONG_PRESS_DELAY_MS, 500);
});
