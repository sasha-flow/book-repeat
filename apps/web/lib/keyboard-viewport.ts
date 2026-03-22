import { useEffect, useState } from "react";

export const KEYBOARD_VIEWPORT_THRESHOLD_PX = 120;

export interface KeyboardViewportState {
  keyboardOpen: boolean;
  viewportHeight: number;
  bottomInset: number;
}

export interface KeyboardViewportSnapshot {
  layoutViewportHeight: number;
  visualViewportHeight: number;
  visualViewportOffsetTop: number;
  editableFocused: boolean;
}

function isEditableElement(element: Element | null): boolean {
  const tagName = element?.tagName?.toLowerCase();

  if (tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (tagName === "input") {
    return true;
  }

  return element instanceof HTMLElement && element.isContentEditable;
}

export function deriveKeyboardViewportState({
  layoutViewportHeight,
  visualViewportHeight,
  visualViewportOffsetTop,
  editableFocused,
}: KeyboardViewportSnapshot): KeyboardViewportState {
  const safeLayoutViewportHeight = Math.max(
    0,
    Math.round(layoutViewportHeight),
  );
  const safeVisualViewportHeight = Math.max(
    0,
    Math.round(visualViewportHeight),
  );
  const safeVisualViewportOffsetTop = Math.max(
    0,
    Math.round(visualViewportOffsetTop),
  );
  const bottomInset = Math.max(
    0,
    safeLayoutViewportHeight -
      safeVisualViewportHeight -
      safeVisualViewportOffsetTop,
  );
  const keyboardOpen =
    editableFocused && bottomInset >= KEYBOARD_VIEWPORT_THRESHOLD_PX;

  return {
    keyboardOpen,
    viewportHeight: keyboardOpen
      ? safeVisualViewportHeight
      : safeLayoutViewportHeight,
    bottomInset: keyboardOpen ? bottomInset : 0,
  };
}

export function readKeyboardViewportState(win: Window): KeyboardViewportState {
  const visualViewport = win.visualViewport;

  return deriveKeyboardViewportState({
    layoutViewportHeight: win.innerHeight,
    visualViewportHeight: visualViewport?.height ?? win.innerHeight,
    visualViewportOffsetTop: visualViewport?.offsetTop ?? 0,
    editableFocused: isEditableElement(win.document.activeElement),
  });
}

export function useKeyboardViewport(): KeyboardViewportState {
  const [state, setState] = useState<KeyboardViewportState>(() => {
    if (typeof window === "undefined") {
      return {
        keyboardOpen: false,
        viewportHeight: 0,
        bottomInset: 0,
      };
    }

    return readKeyboardViewportState(window);
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let frameId: number | null = null;

    const update = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        setState(readKeyboardViewportState(window));
      });
    };

    const visualViewport = window.visualViewport;

    update();
    window.addEventListener("resize", update);
    window.document.addEventListener("focusin", update);
    window.document.addEventListener("focusout", update);
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("resize", update);
      window.document.removeEventListener("focusin", update);
      window.document.removeEventListener("focusout", update);
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  return state;
}
