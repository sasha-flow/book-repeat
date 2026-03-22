export interface BookmarkLongPressTouchPoint {
  identifier: number;
  clientX: number;
  clientY: number;
}

export interface BookmarkLongPressGesture {
  touchId: number;
  startX: number;
  startY: number;
}

export const BOOKMARK_LONG_PRESS_DELAY_MS = 500;
export const BOOKMARK_LONG_PRESS_MOVE_TOLERANCE_PX = 10;

export function createBookmarkLongPressGesture(
  touches: readonly BookmarkLongPressTouchPoint[],
): BookmarkLongPressGesture | null {
  if (touches.length !== 1) {
    return null;
  }

  const [touch] = touches;

  if (!touch) {
    return null;
  }

  return {
    touchId: touch.identifier,
    startX: touch.clientX,
    startY: touch.clientY,
  };
}

export function shouldCancelBookmarkLongPress(
  gesture: BookmarkLongPressGesture | null,
  touches: readonly BookmarkLongPressTouchPoint[],
): boolean {
  if (!gesture || touches.length !== 1) {
    return true;
  }

  const activeTouch = touches[0];

  if (!activeTouch) {
    return true;
  }

  if (activeTouch.identifier !== gesture.touchId) {
    return true;
  }

  const deltaX = activeTouch.clientX - gesture.startX;
  const deltaY = activeTouch.clientY - gesture.startY;

  return (
    deltaX * deltaX + deltaY * deltaY >
    BOOKMARK_LONG_PRESS_MOVE_TOLERANCE_PX *
      BOOKMARK_LONG_PRESS_MOVE_TOLERANCE_PX
  );
}
