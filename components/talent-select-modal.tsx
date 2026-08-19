"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, RotateCcw } from "lucide-react";
import { TALENT_TYPES, SELECTED_TALENT_NOS } from "@/lib/talent-types";
import { saveTalentSelection, MAX_TALENT_SELECTION } from "@/lib/talent-selection";

/**
 * 인재상 선택 팝업 — 34개 중 이 공고에서 볼 항목을 고른다.
 *
 * 저장을 누르기 전까지는 화면에 반영하지 않는다 (draft 상태를 따로 들고 있는다).
 * 취소하면 원래대로 돌아간다.
 *
 * ── createPortal 로 <body> 밑에 그리는 이유
 *    이 컴포넌트는 sidebar.tsx 안에서 호출되는데, 그 <aside> 가
 *    `md:sticky` 다 (sidebar.tsx:124). position:sticky 는 자체 stacking context 를
 *    만들기 때문에, 팝업의 z-50 이 사이드바 *내부에서만* 통한다.
 *    layout.tsx 에서 <main> 이 <aside> 뒤에 오므로 본문 글자가 팝업 위로 올라온다.
 *    포털로 DOM 위치를 <body> 직속으로 옮기면 그 맥락을 완전히 벗어난다.
 */
export default function TalentSelectModal({
  jobId,
  current,
  onClose,
}: {
  jobId: string;
  /** 현재 저장된 선택 — 팝업을 열 때의 시작값 */
  current: number[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<number[]>(current);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 열릴 때 팝업 안으로 초점을 옮긴다.
  // 안 하면 초점이 사이드바 버튼에 남아, Tab 이 팝업이 아니라 뒤쪽 페이지를 훑는다.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // 팝업이 떠 있는 동안 뒤쪽 페이지 스크롤을 잠근다.
  // 원래 값을 기억했다가 되돌린다 — 빈 문자열로 덮으면 다른 곳의 설정을 지울 수 있다.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const atLimit = draft.length >= MAX_TALENT_SELECTION;

  const toggle = (no: number) =>
    setDraft((prev) => {
      if (prev.includes(no)) return prev.filter((n) => n !== no); // 해제는 항상 가능
      // 버튼을 disabled 로 막고 있지만, 키보드 등으로 우회될 수 있어 여기서도 검사한다
      if (prev.length >= MAX_TALENT_SELECTION) return prev;
      return [...prev, no];
    });

  const save = () => {
    saveTalentSelection(jobId, draft);
    onClose();
  };

  // 서버 렌더에는 document 가 없다. 이 팝업은 클릭 후에만 마운트되므로
  // 실제로 걸릴 일은 없지만, 방어적으로 막아둔다.
  if (typeof document === "undefined") return null;

  return createPortal(
    // 배경 — 클릭하면 닫힌다
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(27,26,64,0.45)] p-4"
      onClick={onClose}
    >
      {/* 본체 — 배경 클릭이 여기까지 번지지 않게 막는다 */}
      <div
        ref={dialogRef}
        // 원래 초점을 받을 수 없는 div 에 프로그램으로만 초점을 주기 위해 -1.
        // 0 을 쓰면 Tab 순환에 끼어들어 순서가 어색해진다.
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="인재상 선택"
        className="w-full max-w-[720px] max-h-[85vh] flex flex-col rounded-xl bg-[var(--paper)] shadow-[0_12px_40px_rgba(27,26,64,0.28)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 머리 */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="mark" />
              <h2 className="text-[17px] font-bold text-[var(--ink)]">인재상 선택</h2>
              <span className="text-[13px] font-medium tabular-nums text-[var(--secondary-2)]">
                {draft.length} / {MAX_TALENT_SELECTION}
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[var(--ink-muted)]">
              이 공고에만 적용되며, 이 브라우저에만 저장됩니다. 다른 PC나 시크릿 창에는
              반영되지 않습니다.
            </p>
            {atLimit && (
              <p className="mt-1 text-[12.5px] leading-[1.6] text-[var(--secondary-2)]">
                최대 {MAX_TALENT_SELECTION}개까지 선택할 수 있습니다. 바꾸려면 먼저 해제하세요.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-md p-1.5 text-[var(--ink-muted)] hover:bg-[var(--bg-2)] hover:text-[var(--ink)] transition"
          >
            <X size={17} />
          </button>
        </div>

        {/* 34개 격자 — 길어지면 여기만 스크롤된다 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TALENT_TYPES.map((t) => {
              const on = draft.includes(t.no);
              // 상한에 걸리면 *새로 고르는 것만* 막는다. 이미 고른 항목은 해제할 수 있어야 한다.
              const blocked = !on && atLimit;
              return (
                <button
                  key={t.no}
                  onClick={() => toggle(t.no)}
                  disabled={blocked}
                  aria-pressed={on}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-[13.5px] transition ${
                    on
                      ? "border-[var(--secondary)] bg-[var(--s-50)] font-semibold text-[var(--ink)]"
                      : blocked
                        ? "border-[var(--line)] text-[var(--ink-muted)] opacity-40 cursor-not-allowed"
                        : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
                  }`}
                >
                  <span className="w-5 shrink-0 text-right text-[11.5px] tabular-nums text-[var(--ink-soft)]">
                    {t.no}
                  </span>
                  <span className="truncate">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 발 */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-[var(--line)]">
          <button
            onClick={() => setDraft(SELECTED_TALENT_NOS)}
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
          >
            <RotateCcw size={13} />
            기본값으로
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost">
              취소
            </button>
            <button onClick={save} className="btn-primary">
              저장
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
