"use client";

import { useSyncExternalStore, useCallback } from "react";
import { TALENT_TYPES, SELECTED_TALENT_NOS } from "./talent-types";
import { api, type TalentSetPayload } from "./api";

/**
 * 선정 인재상 세트 — 분석 하나마다 따로 저장한다.
 *
 * ── 세트가 여럿인 이유
 *    한 분석 안에서도 보는 눈이 여러 개다. 기업 공통 인재상, 이 직무 전용,
 *    부서장이 보는 항목이 서로 다르다. 그래서 최소 3개에서 최대 5개짜리 묶음을 여러 벌 두고
 *    묶음마다 이름을 붙인다. 화면에는 묶음마다 삼각형 ~ 오각형이 하나씩 나온다.
 *
 * ── 저장 위치 — 서버 (2026-08-19 localStorage 에서 옮김)
 *    GET/PUT /analysis-jobs/{jobId}/talent-selection
 *    → analysis_jobs.selected_talent_sets (JSON 컬럼)
 *    localStorage 시절에는 이 브라우저에서만 보였다. 분석 하나에 담당자가
 *    여럿 붙으므로 다른 PC·시크릿 창에서도 같은 값이 보여야 한다.
 *
 * ── useSyncExternalStore 를 쓰는 이유
 *    저장소가 React 바깥에 있다. effect 안에서 setState 하는 방식은
 *    eslint react-hooks/set-state-in-effect 가 막는다 (기존 lib/display-settings.ts
 *    가 실제로 이 오류를 갖고 있다. 건드리진 않되 같은 실수를 반복하지 않는다).
 *
 * ── 동기 getSnapshot 과 비동기 fetch 를 잇는 법
 *    getSnapshot 은 값을 즉시 돌려줘야 하는데 fetch 는 그러지 못한다.
 *    그래서 모듈 캐시를 사이에 둔다.
 *      1. getSnapshot 은 캐시만 본다 (없으면 기본 세트)
 *      2. 처음 구독될 때 fetch 를 한 번 걸고, 응답이 오면 캐시를 채운 뒤 알린다
 *      3. React 가 getSnapshot 을 다시 불러 화면이 갱신된다
 *    첫 렌더는 기본값으로 그리고 응답이 도착하면 다시 그린다. 로딩 표시가 없어도
 *    깜빡임이 짧아 어색하지 않다.
 */
export type TalentSet = {
  /** React key 와 편집 대상 지정용. 저장값 안에서만 유일하면 된다 */
  id: string;
  /** 담당자가 직접 붙이는 이름 (예: 공통 인재상) */
  name: string;
  nos: number[];
};

/** 같은 탭 안의 다른 컴포넌트에 알리는 신호 */
const CHANGE_EVENT = "stepi-talent-selection-changed";
const VALID_NOS = new Set(TALENT_TYPES.map((t) => t.no));

/**
 * 한 세트에서 고를 수 있는 최대 개수.
 * 선정분을 레이더(오각형)로 그리므로 5를 넘으면 꼭짓점 라벨이 겹쳐 읽기 어렵다.
 * 미팅 자료의 1안도 "인재상 유형 중 5가지 선택" 이다.
 */
export const MAX_TALENT_SELECTION = 5;

/**
 * 한 세트에서 골라야 하는 최소 개수.
 * 2개는 오각형이 도형이 되지 않아 막대로 떨어지는데, 옆 칸에는 오각형이 있으니
 * 한 세트만 다른 그림이 되어 어색하다. 3개부터는 모든 세트가 같은 모양이다.
 */
export const MIN_TALENT_SELECTION = 3;

/**
 * 세트 개수 상한.
 * 화면은 한 층에 최대 3개를 깔므로 6개면 정확히 두 층이 된다.
 * 그 이상은 지원자 한 명을 보는 데 스크롤이 너무 길어진다.
 */
export const MAX_TALENT_SETS = 6;

/** 이름 입력 상한. 박스 머리에 한 줄로 들어가야 한다 */
export const MAX_SET_NAME = 20;

/** 아직 아무것도 고르지 않았을 때 보여줄 기본 세트 (미팅 자료의 예시) */
export const DEFAULT_TALENT_SETS: TalentSet[] = [
  { id: "set-default", name: "2026년 인재상", nos: SELECTED_TALENT_NOS },
];

/** 이름을 비워둔 세트에 붙일 이름 */
export function defaultSetName(index: number): string {
  return `인재상 ${index + 1}`;
}

/**
 * 새 세트의 id.
 * 저장값 안에서만 겹치지 않으면 되므로 시각 + 일련번호로 충분하다.
 * (브라우저 클릭으로만 만들어지니 서버 렌더와 어긋날 일이 없다)
 */
let idSeq = 0;
export function newTalentSetId(): string {
  idSeq += 1;
  return `set-${Date.now().toString(36)}-${idSeq}`;
}

/** 번호 목록 정리 - 중복·모르는 번호·상한 초과를 한곳에서 거른다 */
function cleanNos(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  return [
    ...new Set(
      input.filter((n): n is number => typeof n === "number" && VALID_NOS.has(n)),
    ),
  ].slice(0, MAX_TALENT_SELECTION);
}

function cleanName(raw: unknown, index: number): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, MAX_SET_NAME) : "";
  return name || defaultSetName(index);
}

/**
 * 서버 응답 → 세트 배열.
 *
 * 백엔드도 같은 규칙을 걸지만, 응답이 항상 정상이라는 보장은 없다
 * (옛 데이터, 수동 편집, 규칙이 서로 어긋난 배포 시점). 읽기 쪽이 화면 직전의
 * 마지막 관문이므로 여기서 한 번 더 정리한다.
 */
function normalize(raw: TalentSetPayload[] | null | undefined): TalentSet[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_TALENT_SETS;
  const seen = new Set<string>();
  const sets = raw.slice(0, MAX_TALENT_SETS).map((s, i) => {
    // id 가 겹치면 React 가 두 박스를 같은 것으로 보고 편집이 엉킨다
    let id = typeof s?.id === "string" && s.id ? s.id : `set-${i + 1}`;
    while (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    return { id, name: cleanName(s?.name, i), nos: cleanNos(s?.nos) };
  });
  return sets.length ? sets : DEFAULT_TALENT_SETS;
}

/**
 * 불러오기 상태.
 *
 * 세트 목록만 넘기면 화면이 **"아직 안 불러왔다"와 "설정된 적 없다"를 구분하지 못한다.**
 * 둘 다 기본 세트로 그려지기 때문이다. 그 상태에서 팝업을 열면 기본 세트가 draft 로
 * 복사되고, 저장하는 순간 서버에 있던 진짜 값을 덮어쓴다.
 * 그래서 상태를 함께 넘겨 ready 이전에는 편집을 막는다.
 */
export type TalentStatus = "loading" | "ready" | "error";

export type TalentSnapshot = {
  sets: TalentSet[];
  status: TalentStatus;
};

/**
 * 분석별 캐시. getSnapshot 이 동기라서 반드시 필요하다.
 * useSyncExternalStore 는 매번 *같은 객체*가 돌아와야 무한 렌더를 피하므로
 * 값이 바뀔 때만 새 객체를 넣는다. 아래 두 상수도 그래서 모듈 수준에 둔다.
 */
const cache = new Map<string, TalentSnapshot>();
const LOADING: TalentSnapshot = { sets: DEFAULT_TALENT_SETS, status: "loading" };
const FAILED: TalentSnapshot = { sets: DEFAULT_TALENT_SETS, status: "error" };
/**
 * 이미 서버에 물어본 분석.
 *
 * 실패해도 여기서 빼지 않는다. getSnapshot 은 렌더마다 여러 번 불리므로,
 * 빼면 곧바로 다시 요청하고 또 실패하고를 끝없이 반복해 브라우저가 멎는다.
 * 재시도는 사용자가 새로고침할 때(모듈이 다시 평가될 때) 자연히 일어난다.
 */
const fetched = new Set<string>();

function notify(): void {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function loadOnce(jobId: string): void {
  if (!jobId || fetched.has(jobId)) return;
  fetched.add(jobId);
  api
    .getTalentSelection(jobId)
    .then((res) => {
      cache.set(jobId, { sets: normalize(res.sets), status: "ready" });
      notify();
    })
    .catch((e) => {
      // 서버가 죽었거나 분석이 없다. 화면은 기본 세트로 그리되 status 를 error 로
      // 남겨, 그 값을 저장해 서버를 덮어쓰는 일이 없게 한다.
      console.warn("[talent-selection] 불러오기 실패:", e);
      cache.set(jobId, FAILED);
      notify();
    });
}

/** 다시 불러오기. 실패했을 때 새로고침 없이 재시도할 유일한 길이다 */
export function retryTalentSets(jobId: string): void {
  if (!jobId) return;
  fetched.delete(jobId);
  cache.set(jobId, LOADING);
  notify();
  loadOnce(jobId);
}

function readSnapshot(jobId: string): TalentSnapshot {
  return cache.get(jobId) ?? LOADING;
}

/** 이 분석에 저장된 인재상 세트 목록과 불러오기 상태 */
export function useTalentSets(jobId: string): TalentSnapshot {
  // 첫 요청은 구독 시점에 건다. useSyncExternalStore 가 subscribe 를 effect 에서
  // 부르므로 렌더 중 부작용이 아니다. getSnapshot 안에서 걸면 렌더마다 불려 위험하다.
  const subscribe = useCallback(
    (onChange: () => void) => {
      loadOnce(jobId);
      window.addEventListener(CHANGE_EVENT, onChange);
      return () => window.removeEventListener(CHANGE_EVENT, onChange);
    },
    [jobId],
  );
  const getSnapshot = useCallback(() => readSnapshot(jobId), [jobId]);
  // 서버 렌더 시점엔 fetch 를 걸 수 없다 -> 불러오는 중으로 그린다.
  const getServerSnapshot = useCallback(() => LOADING, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * 이 분석의 세트를 저장한다.
 *
 * 화면을 먼저 바꾸고 서버에 보낸다. 응답을 기다렸다 바꾸면 체크박스가 굼떠 보인다.
 * 실패하면 이전 값으로 되돌리고 에러를 던져 호출한 쪽이 알 수 있게 한다.
 */
export async function saveTalentSets(jobId: string, sets: TalentSet[]): Promise<void> {
  // 팝업 UI 만 막으면 우회될 수 있으므로 저장 시점에도 상한을 보장한다
  const clean = sets.slice(0, MAX_TALENT_SETS).map((s, i) => ({
    id: s.id,
    name: cleanName(s.name, i),
    nos: cleanNos(s.nos).sort((a, b) => a - b),
  }));

  const prev = cache.get(jobId);
  cache.set(jobId, { sets: clean, status: "ready" });
  fetched.add(jobId);
  notify();

  try {
    const res = await api.putTalentSelection(jobId, clean);
    // 서버가 정리한 결과를 정본으로 삼는다 (id 중복 분리 등)
    cache.set(jobId, { sets: normalize(res.sets), status: "ready" });
    notify();
  } catch (e) {
    if (prev) cache.set(jobId, prev);
    else cache.delete(jobId);
    notify();
    throw e;
  }
}
