"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import {
  type AxisResult,
  type ItemResult,
  type Evidence,
  evidenceFor,
  formatScore,
  TALENT_SCORE_MAX,
} from "@/lib/talent-evaluation";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { MockBadge } from "@/components/mock-mark";

/**
 * 인재상 하나의 문항별 판정과 근거를 보여주는 오른쪽 패널.
 *
 * ── 왜 패널인가
 *    "점수는 왠만하면 다 근거가 있어야 한다"가 이 기능의 목적이다.
 *    점수만 크게 띄우고 근거를 감추면 만들 이유가 없다. 목록을 뒤에 남겨 두고
 *    오른쪽에서 밀려 나오므로, 인재상을 이어서 눌러 비교할 수 있다.
 *
 * ── createPortal 이 필요한 이유
 *    sidebar.tsx 의 <aside> 가 md:sticky 라 자체 stacking context 를 만든다.
 *    그 안에서 z-50 을 줘도 사이드바 내부에서만 통하고, layout.tsx 에서
 *    <main> 이 <aside> 뒤에 오므로 본문 글자가 패널 위로 올라온다.
 *    talent-select-modal.tsx 가 같은 이유로 포털을 쓴다.
 *
 * ── N(판정 불가) 를 X 와 다르게 그리는 이유
 *    N 은 분모에서 빠진다. 미충족이 아니라 판정 자체를 못 한 것이다.
 *    회색으로 X 옆에 두면 둘이 섞여 보여, 점수가 왜 소수점인지 설명되지 않는다.
 */

export default function TalentEvidenceDrawer({
  axis,
  applicantId,
  onClose,
}: {
  axis: AxisResult;
  applicantId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // 펼쳐 놓은 문항. 여러 개를 동시에 열어 비교할 수 있어야 한다.
  const [open, setOpen] = useState<string[]>([]);

  const toggle = useCallback((id: string) => {
    setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 초점을 패널 안에 가두고, 닫힐 때 눌렀던 자리로 돌려준다
  useFocusTrap(dialogRef);

  // 패널이 떠 있는 동안 뒤쪽 페이지 스크롤을 잠근다
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === "undefined") return null;

  // 계단 문항은 한 덩어리로 묶는다. 같은 사실을 난이도로 나눈 것이라
  // 흩어 놓으면 세 문항이 각각 다른 근거인 줄로 읽힌다.
  const groups = groupByLadder(axis.items);

  return createPortal(
    <>
      <style>{`
        @keyframes stepi-drawer-slide {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce){
          .stepi-drawer-slide { animation: none !important; }
        }
      `}</style>

      {/* 배경 - 클릭하면 닫힌다 */}
      <div
        className="fixed inset-0 z-50 flex justify-end bg-[rgba(27,26,64,0.45)]"
        onClick={onClose}
      >
        {/* 본체 - 배경 클릭이 여기까지 번지지 않게 막는다 */}
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`${axis.axis} 판정 근거`}
          onClick={(e) => e.stopPropagation()}
          className="stepi-drawer-slide flex h-full w-full max-w-[560px] flex-col bg-[var(--paper)] shadow-[-12px_0_40px_rgba(27,26,64,0.28)] outline-none"
          style={{ animation: "stepi-drawer-slide 0.22s cubic-bezier(0.22,0.68,0.28,1) both" }}
        >
          {/* ── 머리 ── */}
          <div className="shrink-0 border-b border-[var(--line)] px-5 pt-4 pb-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 truncate text-[18px] font-bold text-[var(--ink)]">{axis.axis}</h3>
                  <MockBadge />
                </div>
                <p className="mt-1 text-[13px] text-[var(--ink-muted)] tabular-nums">
                  충족 {axis.o_count} · 미충족 {axis.x_count} · 판정 불가 {axis.n_count}
                </p>
              </div>
              <div className="flex shrink-0 items-start gap-3">
                <div className="text-right">
                  <div className="serif text-[22px] leading-none tabular-nums text-[var(--ink)]">
                    {axis.score === null ? "판정 불가" : `${formatScore(axis.score)}`}
                    {axis.score !== null && (
                      <span className="ml-1 text-[14px] text-[var(--ink-soft)]">
                        / {TALENT_SCORE_MAX}
                      </span>
                    )}
                  </div>
                  {axis.n_count > 0 && (
                    <div className="mt-1.5 text-[12px] text-[var(--secondary-2)] tabular-nums">
                      유효 {axis.effective_total}문항 기준
                    </div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  aria-label="닫기"
                  className="mt-0.5 rounded p-1 text-[var(--ink-muted)] transition hover:bg-[var(--bg-2)] hover:text-[var(--ink)]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 점수가 왜 이 값인지 한 줄로 밝힌다. 소수점이 붙은 이유가 여기 있다 */}
            <p className="mt-2.5 text-[12.5px] leading-[1.6] text-[var(--ink-muted)]">
              {axis.score === null
                ? "판정할 수 있는 문항이 없어 점수를 내지 못했습니다."
                : axis.n_count > 0
                  ? `문항 ${axis.items.length}개 중 ${axis.n_count}개는 근거 데이터가 없어 계산에서 뺐습니다. 남은 ${axis.effective_total}개 중 ${axis.o_count}개를 충족해 ${formatScore(axis.score)}점입니다.`
                  : `문항 ${axis.items.length}개 중 ${axis.o_count}개를 충족해 ${formatScore(axis.score)}점입니다.`}
            </p>

            {!axis.defined && (
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[var(--ink-soft)]">
                이 인재상은 아직 문항표가 없어 아래 문항은 예시입니다.
              </p>
            )}
          </div>

          {/* ── 문항 목록 ── 근거 칸의 논문·회사·인용문은 전부 지어낸 값이다 */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <ul className="space-y-2.5">
              {groups.map((g) =>
                g.ladder ? (
                  // 계단 이름은 떨어져 있으면 겹칠 수 있으므로 첫 문항 id 를 key 로 쓴다
                  <li key={g.items[0].item_id}>
                    <div className="rounded-lg border border-[var(--line)] px-2.5 pt-2 pb-1">
                      <div className="mb-1 px-1 text-[11.5px] font-medium tracking-wide text-[var(--ink-soft)]">
                        {g.ladder} 계단
                      </div>
                      <ul>
                        {g.items.map((item) => (
                          <li key={item.item_id}>
                            <ItemRow
                              item={item}
                              applicantId={applicantId}
                              open={open.includes(item.item_id)}
                              onToggle={() => toggle(item.item_id)}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ) : (
                  g.items.map((item) => (
                    <li key={item.item_id}>
                      <ItemRow
                        item={item}
                        applicantId={applicantId}
                        open={open.includes(item.item_id)}
                        onToggle={() => toggle(item.item_id)}
                      />
                    </li>
                  ))
                ),
              )}
            </ul>
          </div>

        </div>
      </div>
    </>,
    document.body,
  );
}

/** 계단(ladder) 이 같은 문항끼리 묶는다. 원래 순서는 유지한다 */
function groupByLadder(items: ItemResult[]): Array<{ ladder: string | null; items: ItemResult[] }> {
  const out: Array<{ ladder: string | null; items: ItemResult[] }> = [];
  for (const item of items) {
    const group = item.ladder ? item.ladder.split("-")[0] : null;
    const last = out[out.length - 1];
    if (group && last && last.ladder === group) {
      last.items.push(item);
    } else {
      out.push({ ladder: group, items: [item] });
    }
  }
  return out;
}

/** 판정 배지. --bad 는 쓰지 않는다. 오류 색이고, 미충족은 잘못이 아니다 */
function VerdictBadge({ verdict }: { verdict: ItemResult["verdict"] }) {
  const style =
    verdict === "O"
      ? "border-[var(--good)] text-[var(--good)]"
      : verdict === "X"
        ? "border-[var(--line-strong)] text-[var(--ink-soft)]"
        : "border-dashed border-[var(--secondary)] text-[var(--secondary-2)]";
  return (
    // role 없는 span 의 aria-label 은 스크린리더가 무시하고 "O" 를 그대로 읽는다
    <span
      role="img"
      aria-label={verdict === "O" ? "충족" : verdict === "X" ? "미충족" : "판정 불가"}
      className={`mt-[1px] inline-flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full border text-[12px] font-bold ${style}`}
    >
      <span aria-hidden="true">{verdict}</span>
    </span>
  );
}

function ItemRow({
  item,
  applicantId,
  open,
  onToggle,
}: {
  item: ItemResult;
  applicantId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const review = item.flags.includes("judgment_boundary");
  // 근거는 펼칠 때만 만든다. 34유형 전부를 미리 만들면 대부분 버려진다
  const evidence = useMemo(
    () => (open ? evidenceFor(applicantId, item) : []),
    [open, applicantId, item],
  );
  return (
    <div className="border-b border-[var(--line)] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-2.5 rounded px-1 py-2.5 text-left transition hover:bg-[var(--bg-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--secondary)]"
      >
        <VerdictBadge verdict={item.verdict} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-[1.55] text-[var(--ink)]">{item.question}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[var(--ink-soft)]">
            <span>{item.judged_by === "code" ? "코드 판정" : "LLM 판정"}</span>
            {review && <span className="text-[var(--secondary-2)]">검토 권장</span>}
            {item.flags.includes("date_calc") && <span>날짜 계산</span>}
            {item.flags.includes("data_sparse") && <span>데이터 부족</span>}
          </span>
        </span>
        {open ? (
          <ChevronDown size={15} className="mt-1 shrink-0 text-[var(--ink-soft)]" />
        ) : (
          <ChevronRight size={15} className="mt-1 shrink-0 text-[var(--ink-soft)]" />
        )}
      </button>

      {open && (
        <div className="space-y-3 pb-3.5 pl-[31px] pr-1">
          <Field label="판정 규칙">
            <p className="text-[13px] leading-[1.65] text-[var(--ink-2)]">{item.rule}</p>
          </Field>

          {item.verdict === "N" && (
            <Field label="판정 불가">
              <p className="text-[13px] leading-[1.65] text-[var(--ink-2)]">
                {item.reason}
              </p>
              <p className="mt-1 text-[12px] leading-[1.6] text-[var(--secondary-2)]">
                점수 계산에서 제외되었습니다.
              </p>
            </Field>
          )}

          {evidence.length > 0 && (
            <Field label="근거">
              <ul className="space-y-2.5">
                {evidence.map((ev, i) => (
                  <li key={i}>
                    <EvidenceView ev={ev} />
                  </li>
                ))}
              </ul>
            </Field>
          )}

          {item.verdict === "X" && (
            <Field label="판정">
              <p className="text-[13px] leading-[1.65] text-[var(--ink-2)]">
                조건을 충족하는 근거를 찾지 못했습니다.
              </p>
            </Field>
          )}

          {item.x_example && (
            <Field label="이런 경우는 미충족">
              <p className="text-[13px] leading-[1.65] text-[var(--ink-muted)]">{item.x_example}</p>
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">{label}</div>
      {children}
    </div>
  );
}

/**
 * 근거는 종류마다 다르게 보여준다.
 * 자소서 인용은 papers-section.tsx 의 관례를 그대로 따랐다
 * (좌측 세로선 + italic + 곡선 따옴표).
 */
function EvidenceView({ ev }: { ev: Evidence }) {
  if (ev.type === "essay") {
    return (
      <div>
        <p className="border-l-2 border-[var(--line-strong)] pl-2.5 text-[13px] italic leading-[1.7] text-[var(--ink-muted)]">
          “{ev.quote}”
        </p>
        <p className="mt-1 pl-2.5 text-[11.5px] text-[var(--ink-soft)]">
          자기소개서 {ev.essay_index}번 {ev.question && `· ${ev.question}`}
        </p>
      </div>
    );
  }

  if (ev.type === "paper") {
    return (
      <div className="rounded border border-[var(--line)] px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] leading-[1.55] text-[var(--ink)]">{ev.title}</p>
          {ev.match_status !== "matched" && (
            // 자기보고 서지 메타일 뿐 원문으로 확인된 게 아니다. 1022건 중 1010건이 여기 해당한다
            <span className="shrink-0 rounded-full border border-[var(--line-strong)] px-1.5 py-[1px] text-[11px] text-[var(--ink-soft)]">
              미검증
            </span>
          )}
        </div>
        <p className="mt-1 text-[11.5px] text-[var(--ink-soft)] tabular-nums">
          {ev.journal} · {ev.year} · 저자 {ev.author_order}
        </p>
      </div>
    );
  }

  if (ev.type === "career") {
    return (
      <div className="rounded border border-[var(--line)] px-2.5 py-2">
        <p className="text-[13px] leading-[1.55] text-[var(--ink)]">
          {ev.company} {ev.title_text && <span className="text-[var(--ink-muted)]">{ev.title_text}</span>}
        </p>
        <p className="mt-1 text-[11.5px] text-[var(--ink-soft)] tabular-nums">{ev.period_text}</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-[var(--line)] px-2.5 py-2">
      <p className="text-[13px] leading-[1.55] text-[var(--ink)]">
        {ev.school}
        {ev.degree && <span className="ml-1.5 text-[var(--ink-muted)]">{ev.degree}</span>}
        {ev.status && <span className="ml-1.5 text-[var(--ink-soft)]">{ev.status}</span>}
      </p>
      <p className="mt-1 whitespace-pre-line text-[11.5px] leading-[1.6] text-[var(--ink-soft)]">
        {ev.major_field ?? ev.major}
      </p>
      <p className="mt-1 text-[11.5px] text-[var(--ink-soft)] tabular-nums">{ev.period_text}</p>
    </div>
  );
}
