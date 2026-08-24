"use client";

import { useEffect, type RefObject } from "react";

/**
 * 팝업 안에 Tab 순환을 가둔다.
 *
 * aria-modal="true" 를 선언해 놓고 초점만 옮기면, 마지막 요소에서 Tab 을 누르는 순간
 * 초점이 뒤쪽 페이지로 빠져나간다. 그 요소들은 오버레이에 가려 보이지 않으므로
 * 키보드 사용자는 자기가 어디에 있는지 알 수 없게 된다.
 *
 * 열릴 때 팝업 안으로 초점을 옮기고, 닫힐 때 눌렀던 자리로 되돌린다.
 */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useFocusTrap(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // 닫힐 때 돌아갈 자리. 트리거가 사라졌으면 억지로 되돌리지 않는다
    const opener = document.activeElement as HTMLElement | null;
    root.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === root,
      );
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [ref]);
}
