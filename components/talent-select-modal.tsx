"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, RotateCcw, Plus, Trash2 } from "lucide-react";
import { TALENT_TYPES } from "@/lib/talent-types";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  saveTalentSets,
  newTalentSetId,
  defaultSetName,
  DEFAULT_TALENT_SETS,
  MIN_TALENT_SELECTION,
  MAX_TALENT_SELECTION,
  MAX_TALENT_SETS,
  MAX_SET_NAME,
  type TalentSet,
} from "@/lib/talent-selection";

/**
 * 인재상 선택 팝업 - 5개짜리 세트를 여러 벌 만든다.
 *
 * 위쪽 줄에서 세트를 고르고, 아래 34개 격자는 *고른 세트 하나*를 편집한다.
 * 세트마다 격자를 따로 그리면 같은 34개가 화면에 여러 번 나와 어디를 보는지
 * 알 수 없다. 편집 대상은 언제나 하나로 좁힌다.
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
  /** 현재 저장된 세트들 - 팝업을 열 때의 시작값 */
  current: TalentSet[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TalentSet[]>(current);
  // 편집 중인 세트. 삭제로 사라질 수 있어 id 만 들고 있다가 매번 찾는다.
  const [activeId, setActiveId] = useState<string>(current[0]?.id ?? "");
  // 저장은 서버 왕복이라 실패할 수 있다. 실패하면 팝업을 닫지 않고 알린다.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const active = draft.find((s) => s.id === activeId) ?? draft[0];
  const atLimit = (active?.nos.length ?? 0) >= MAX_TALENT_SELECTION;
  // 덜 채운 세트가 하나라도 있으면 저장을 막는다.
  // 세트를 만들자마자 0개로 저장되면 화면에 빈 박스가 남는다.
  const short = draft.filter((s) => s.nos.length < MIN_TALENT_SELECTION);

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 초점을 팝업 안에 가둔다.
  // 안 하면 마지막 요소에서 Tab 을 누를 때 초점이 뒤쪽 페이지로 빠져나가는데,
  // 그 요소들은 오버레이에 가려 보이지 않아 어디에 있는지 알 수 없게 된다.
  useFocusTrap(dialogRef);

  // 팝업이 떠 있는 동안 뒤쪽 페이지 스크롤을 잠근다.
  // 원래 값을 기억했다가 되돌린다 - 빈 문자열로 덮으면 다른 곳의 설정을 지울 수 있다.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /** 편집 중인 세트만 바꾼다 */
  const patchActive = (fn: (s: TalentSet) => TalentSet) =>
    setDraft((prev) => prev.map((s) => (s.id === active?.id ? fn(s) : s)));

  const toggle = (no: number) =>
    patchActive((s) => {
      if (s.nos.includes(no)) return { ...s, nos: s.nos.filter((n) => n !== no) }; // 해제는 항상 가능
      // 버튼을 disabled 로 막고 있지만, 키보드 등으로 우회될 수 있어 여기서도 검사한다
      if (s.nos.length >= MAX_TALENT_SELECTION) return s;
      return { ...s, nos: [...s.nos, no] };
    });

  const addSet = () => {
    if (draft.length >= MAX_TALENT_SETS) return;
    const set: TalentSet = {
      id: newTalentSetId(),
      name: defaultSetName(draft.length),
      nos: [],
    };
    setDraft((prev) => [...prev, set]);
    setActiveId(set.id); // 새로 만든 세트를 바로 편집하게 넘긴다
  };

  const removeSet = (id: string) => {
    // 마지막 한 벌은 남긴다. 세트가 0개면 화면에 아무것도 안 나와
    // "고장난 것" 처럼 보인다.
    if (draft.length <= 1) return;
    const next = draft.filter((s) => s.id !== id);
    setDraft(next);
    if (activeId === id) setActiveId(next[0].id);
  };

  const reset = () => {
    setDraft(DEFAULT_TALENT_SETS);
    setActiveId(DEFAULT_TALENT_SETS[0].id);
  };

  const save = async () => {
    // 버튼을 disabled 로 막고 있지만, 키보드 등으로 우회될 수 있어 여기서도 검사한다
    if (short.length > 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveTalentSets(jobId, draft);
      onClose();
    } catch (e) {
      // 닫지 않는다. 닫으면 저장된 줄 알고 나갔다가 값이 되돌아가 있다.
      setSaveError(e instanceof Error ? e.message : "저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  // 서버 렌더에는 document 가 없다. 이 팝업은 클릭 후에만 마운트되므로
  // 실제로 걸릴 일은 없지만, 방어적으로 막아둔다.
  if (typeof document === "undefined") return null;

  return createPortal(
    // 배경 - 클릭하면 닫힌다. 뒤 화면은 흐리게 깐다
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(27,26,64,0.32)] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 본체 - 배경 클릭이 여기까지 번지지 않게 막는다 */}
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
                {draft.length} / {MAX_TALENT_SETS} 세트
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[var(--ink-muted)]">
              세트마다 {MIN_TALENT_SELECTION}개에서 {MAX_TALENT_SELECTION}개까지 고릅니다. 이
              분석에만 적용됩니다.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-md p-1.5 text-[var(--ink-muted)] hover:bg-[var(--bg-2)] hover:text-[var(--ink)] transition"
          >
            <X size={17} />
          </button>
        </div>

        {/* 세트 고르기 줄 */}
        <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
          {draft.map((s) => {
            const on = s.id === active?.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                aria-pressed={on}
                className={`max-w-[190px] rounded-full border px-3.5 py-1.5 text-[13.5px] transition ${
                  on
                    ? "border-[var(--secondary)] bg-[var(--s-50)] font-semibold text-[var(--ink)]"
                    : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
                }`}
              >
                <span className="block truncate">
                  {s.name}
                  {/* 덜 채운 세트는 칩에서 바로 보이게 한다.
                      다른 세트를 편집하는 동안에도 남은 일이 눈에 띄어야 한다 */}
                  <span
                    className={`ml-1.5 tabular-nums ${
                      s.nos.length < MIN_TALENT_SELECTION
                        ? "font-semibold text-[var(--bad)]"
                        : "text-[var(--ink-soft)]"
                    }`}
                  >
                    {s.nos.length}
                  </span>
                </span>
              </button>
            );
          })}
          {draft.length < MAX_TALENT_SETS && (
            <button
              onClick={addSet}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--line-strong)] px-3.5 py-1.5 text-[13.5px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
            >
              <Plus size={14} />
              세트 추가
            </button>
          )}
        </div>

        {/* 고른 세트의 이름 + 34개 격자 - 길어지면 여기만 스크롤된다 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {active && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={active.name}
                  onChange={(e) =>
                    patchActive((s) => ({ ...s, name: e.target.value.slice(0, MAX_SET_NAME) }))
                  }
                  maxLength={MAX_SET_NAME}
                  aria-label="세트 이름"
                  placeholder={defaultSetName(draft.indexOf(active))}
                  className="min-w-0 flex-1 rounded-md border border-[var(--line)] px-3 py-2 text-[14.5px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--secondary)] transition"
                />
                <span className="shrink-0 text-[13px] tabular-nums text-[var(--secondary-2)]">
                  {active.nos.length} / {MAX_TALENT_SELECTION}
                </span>
                <button
                  onClick={() => removeSet(active.id)}
                  disabled={draft.length <= 1}
                  title={draft.length <= 1 ? "마지막 세트는 지울 수 없습니다" : "이 세트 삭제"}
                  aria-label="이 세트 삭제"
                  className="shrink-0 rounded-md p-2 text-[var(--ink-muted)] transition hover:bg-[var(--bg-2)] hover:text-[var(--bad)] disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--ink-muted)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {active.nos.length < MIN_TALENT_SELECTION ? (
                <p className="mb-3 text-[12.5px] leading-[1.6] text-[var(--bad)]">
                  {MIN_TALENT_SELECTION}개 이상 골라주세요.
                </p>
              ) : (
                atLimit && (
                  <p className="mb-3 text-[12.5px] leading-[1.6] text-[var(--secondary-2)]">
                    한 세트에 최대 {MAX_TALENT_SELECTION}개까지 고를 수 있습니다. 바꾸려면 먼저
                    해제하세요.
                  </p>
                )
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TALENT_TYPES.map((t) => {
                  const on = active.nos.includes(t.no);
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
            </>
          )}
        </div>

        {/* 발 */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-[var(--line)]">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
          >
            <RotateCcw size={13} />
            기본값으로
          </button>
          <div className="flex items-center gap-3">
            {short.length > 0 && (
              <span className="text-[12.5px] text-[var(--bad)]">
                {short.length}개 세트가 {MIN_TALENT_SELECTION}개 미만입니다
              </span>
            )}
            {saveError && (
              <span className="text-[12.5px] text-[var(--bad)]">
                저장하지 못했습니다. {saveError}
              </span>
            )}
            <button onClick={onClose} disabled={saving} className="btn-ghost">
              취소
            </button>
            <button
              onClick={save}
              disabled={short.length > 0 || saving}
              title={
                short.length > 0
                  ? `모든 세트에 ${MIN_TALENT_SELECTION}개 이상 골라야 저장할 수 있습니다`
                  : undefined
              }
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "저장 중" : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
