"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ListChecks, Plus, X } from "lucide-react";
import PageHeader from "@/components/page-header";
import { ExperimentalBadge } from "@/components/mock-mark";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { api, ApiError, type TalentCriteria, type TalentCriterion, type TalentCriterionInput } from "@/lib/api";

type Form = TalentCriterionInput & { item_id: string | null; updated_at: string; saved_name: string };

const FIELDS: { key: keyof TalentCriterionInput; label: string; max: number; required: boolean; rows: number }[] = [
  { key: "name", label: "문항 이름", max: 50, required: true, rows: 1 },
  { key: "question", label: "질문", max: 500, required: true, rows: 3 },
  { key: "rule", label: "판정 기준", max: 1000, required: true, rows: 5 },
  { key: "x_example", label: "X 예시", max: 500, required: false, rows: 3 },
];

const failText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.reason : fallback);

/** 인재상 34유형의 문항(기준 문장) 추가·수정·삭제(TALENT-001) */
export default function TalentCriteriaPage() {
  const [data, setData] = useState<TalentCriteria | null>(null);
  const [failed, setFailed] = useState(false);
  const [axisNo, setAxisNo] = useState(1);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.getTalentCriteria());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 첫 조회
    void load();
  }, [load]);

  useEffect(() => {
    if (!form || saving) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setForm(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [form, saving]);

  const axis = data?.axes.find((a) => a.no === axisNo);

  function open(item: TalentCriterion | null) {
    setError(null);
    setForm(
      item
        ? { item_id: item.item_id, name: item.name, question: item.question, rule: item.rule, x_example: item.x_example ?? "", updated_at: item.updated_at, saved_name: item.name }
        : { item_id: null, name: "", question: "", rule: "", x_example: "", updated_at: "", saved_name: "" },
    );
  }

  async function run(job: () => Promise<unknown>) {
    setSaving(true);
    setError(null);
    try {
      await job();
      setForm(null);
      await load();
    } catch (e) {
      setError(failText(e, "저장하지 못하였습니다. 잠시 후 다시 시도해 주십시오."));
      // 다른 곳에서 먼저 바뀐 경우 목록을 새로 받아 둠
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) await load();
    } finally {
      setSaving(false);
    }
  }

  function save() {
    if (!form) return;
    const body = { name: form.name.trim(), question: form.question.trim(), rule: form.rule.trim(), x_example: form.x_example?.trim() || null };
    const empty = FIELDS.find((f) => f.required && !body[f.key]);
    if (empty) return setError(`${empty.label}을(를) 입력해 주십시오.`);
    void run(() =>
      form.item_id
        ? api.putTalentCriterion(form.item_id, { ...body, updated_at: form.updated_at })
        : api.addTalentCriterion(axisNo, body),
    );
  }

  function remove() {
    if (!form?.item_id) return;
    if (!window.confirm(`${form.saved_name}을(를) 삭제하시겠습니까? 삭제한 후에는 복구할 수 없습니다.`)) return;
    void run(() => api.deleteTalentCriterion(form.item_id!, form.updated_at));
  }

  return (
    <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
      <PageHeader
        eyebrow="지원자 분석"
        icon={ListChecks}
        title="인재상 기준"
        description="인재상 34유형의 문항과 판정 기준입니다. 수정한 내용은 지원자 상세의 인재상에 바로 반영됩니다. 판정 기준을 고치거나 새로 추가한 문항은 판정 기준이 마련될 때까지 N 으로 표시됩니다."
        wideDescription
      />

      {failed ? (
        <div className="mt-8 panel text-[15px] text-[var(--ink-muted)]">인재상 기준을 불러오지 못하였습니다. 잠시 후 새로고침해 주십시오.</div>
      ) : !data ? (
        <div role="status" className="mt-8 text-[15px] text-[var(--ink-muted)]">불러오는 중입니다</div>
      ) : (
        <div className="mt-8 flex gap-6 items-start">
          <nav aria-label="인재상 유형" className="w-[210px] shrink-0 border border-[var(--line)] bg-[var(--paper)]">
            {data.axes.map((a) => (
              <button
                key={a.no}
                type="button"
                aria-current={a.no === axisNo}
                onClick={() => setAxisNo(a.no)}
                className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-[14.5px] border-b border-[var(--line)] last:border-b-0 transition ${
                  a.no === axisNo ? "bg-[var(--ink)] text-white font-semibold" : "text-[var(--ink)] hover:bg-[var(--bg-2)]"
                }`}
              >
                <span>
                  {a.no}. {a.axis}
                </span>
                <span className={`text-[13px] tabular-nums ${a.no === axisNo ? "text-white" : "text-[var(--ink-muted)]"}`}>{a.items.length}</span>
              </button>
            ))}
          </nav>

          <section className="panel flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4 pb-3.5 mb-2 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <span className="mark" />
                <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--ink)]">
                  {axis?.no}. {axis?.axis}
                </h2>
                <ExperimentalBadge />
              </div>
              <button type="button" className="btn-primary inline-flex items-center gap-1.5" onClick={() => open(null)}>
                <Plus size={16} aria-hidden="true" /> 문항 추가
              </button>
            </div>

            {!axis?.items.length ? (
              <p className="py-8 text-center text-[15px] text-[var(--ink-muted)]">등록된 문항이 없습니다.</p>
            ) : (
              <table className="w-full text-[14.5px] border-collapse">
                <thead>
                  <tr className="text-left text-[13px] text-[var(--ink-muted)] border-b border-[var(--line)]">
                    <th className="py-2.5 pr-3 w-[44px] font-medium">번호</th>
                    <th className="py-2.5 pr-3 w-[150px] font-medium">문항 이름</th>
                    <th className="py-2.5 pr-3 font-medium">질문</th>
                    <th className="py-2.5 pr-3 font-medium">판정 기준</th>
                    <th className="py-2.5 w-[200px] font-medium">판정 방식</th>
                  </tr>
                </thead>
                <tbody>
                  {axis.items.map((it, i) => (
                    <tr
                      key={it.item_id}
                      onClick={() => open(it)}
                      className="align-top border-b border-[var(--line)] last:border-b-0 cursor-pointer hover:bg-[var(--bg-2)]"
                    >
                      <td className="py-3 pr-3 tabular-nums text-[var(--ink-muted)]">{i + 1}</td>
                      <td className="py-3 pr-3 font-semibold text-[var(--ink)] whitespace-pre-line">
                        <button type="button" className="text-left hover:underline" onClick={(e) => (e.stopPropagation(), open(it))}>
                          {it.name}
                        </button>
                      </td>
                      <td className="py-3 pr-3 text-[var(--ink)] whitespace-pre-line">{it.question}</td>
                      <td className="py-3 pr-3 text-[var(--ink)] whitespace-pre-line">{it.rule}</td>
                      <td className="py-3 text-[13.5px]">
                        {it.judged_by === "code" ? (
                          <span className="text-[var(--ink)]">규칙 판정</span>
                        ) : (
                          <>
                            <span className="font-semibold text-[var(--ink)]">판정 대기</span>
                            {it.pending_reason && <span className="block mt-1 text-[var(--ink-muted)]">{it.pending_reason}</span>}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(27,26,64,0.32)] p-4">
          <DialogForm label={form.item_id ? "문항 수정" : "문항 추가"} onSubmit={save}>
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[var(--line)]">
              <h2 className="text-[17px] font-bold text-[var(--ink)]">
                {axis?.axis} 문항 {form.item_id ? "수정" : "추가"}
              </h2>
              <button
                type="button"
                onClick={() => setForm(null)}
                aria-label="닫기"
                className="shrink-0 p-1.5 text-[var(--ink-muted)] hover:bg-[var(--bg-2)] hover:text-[var(--ink)] transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="block mb-1.5 text-[14px] font-semibold text-[var(--ink)]">
                    {f.label}
                    {f.required && <em className="ml-1 not-italic text-[12.5px] font-normal text-[var(--ink-muted)]">필수</em>}
                  </span>
                  {f.rows === 1 ? (
                    <input
                      className="input"
                      maxLength={f.max}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  ) : (
                    <textarea
                      className="input"
                      rows={f.rows}
                      maxLength={f.max}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-[var(--line)]">
              <div className="min-w-0">
                {error && (
                  <p role="alert" className="text-[14px] text-[var(--bad)]">
                    {error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {form.item_id && (
                  <button type="button" className="px-3 py-2 text-[14px] text-[var(--bad)] hover:underline" onClick={remove} disabled={saving}>
                    삭제
                  </button>
                )}
                <button type="button" className="btn-ghost" onClick={() => setForm(null)} disabled={saving}>
                  취소
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "저장 중" : "저장"}
                </button>
              </div>
            </div>
          </DialogForm>
        </div>
      )}
    </div>
  );
}

/** 편집 창. 열릴 때마다 새로 붙어 초점을 가두고 닫히면 누른 자리로 돌려줌 */
function DialogForm({ label, onSubmit, children }: { label: string; onSubmit: () => void; children: ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);
  useFocusTrap(ref);
  return (
    <form
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="w-full max-w-[640px] max-h-[88vh] flex flex-col bg-[var(--paper)] shadow-[0_12px_40px_rgba(27,26,64,0.28)] outline-none"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
