"use client";

import { useSyncExternalStore, useCallback } from "react";
import { TALENT_TYPES, SELECTED_TALENT_NOS } from "./talent-types";

/**
 * 선정 인재상 — 공고(분석작업) 하나마다 따로 저장한다.
 *
 * ── 왜 백엔드가 필요 없나
 *    지원자 페이지 URL 이 공고 ID 를 담고 있다.
 *      /jobs/01KRK.../applicants/0126-000069
 *    이 ID 를 저장 키에 붙이면 공고별로 분리되고, 같은 공고의 지원자는
 *    같은 ID 를 거치므로 자동으로 같은 선택을 공유한다.
 *
 * ── 한계 - 백엔드 작업 전. 가능하면 수정해야 할 부분.
 *    이 브라우저에만 저장된다. 다른 PC·시크릿 창에서는 기본값으로 보인다.
 *    여럿이 공유하려면 AnalysisJob 에 컬럼을 추가해야 한다(백엔드).
 *    그때는 이 파일의 읽기/쓰기만 API 로 바꾸면 화면은 그대로 쓴다.
 *
 * ── useState + useEffect 가 아니라 useSyncExternalStore 를 쓰는 이유
 *    localStorage 는 React 바깥의 저장소다. effect 안에서 setState 하는 방식은
 *    eslint react-hooks/set-state-in-effect 가 막는다 (기존 lib/display-settings.ts
 *    가 실제로 이 오류를 갖고 있다 — 건드리진 않되 같은 실수를 반복하지 않는다).
 *    useSyncExternalStore 는 이 용도로 만들어진 API 라 서버/브라우저 렌더 불일치도
 *    React 가 알아서 처리한다.
 */

// v2: 31번(분석력 중복) 삭제 후 번호를 1~34로 당겼다.
// 접미사를 올리지 않으면 예전에 저장된 번호가 *다른 인재상*을 가리키게 된다
// (예전 33 = 포용성 → 지금 33 = 성장지향성). 옛 값은 무시하고 기본값으로 돌아간다.
const KEY_PREFIX = "stepi-talent-selection-v2:";
/** 같은 탭 안의 다른 컴포넌트에 알리는 신호 (storage 이벤트는 *다른* 탭에서만 발생) */
const CHANGE_EVENT = "stepi-talent-selection-changed";
const VALID_NOS = new Set(TALENT_TYPES.map((t) => t.no));

/**
 * 한 공고에서 고를 수 있는 최대 개수.
 * 선정분을 레이더(오각형)로 그리므로 5를 넘으면 꼭짓점 라벨이 겹쳐 읽기 어렵다.
 * 미팅 자료의 1안도 "2025년 인재상으로 유형 중 5가지 선택" 이다.
 */
export const MAX_TALENT_SELECTION = 5;
const KeyOf = (jobId: string) => KEY_PREFIX+jobId;
const cache = new Map<string, {raw: string | null; value: number[]}>();

function parse(raw: string | null): number[] {
    if (!raw) return SELECTED_TALENT_NOS;
    try{
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return SELECTED_TALENT_NOS;
        // localStorage 는 개발자도구로 누구나 고칠 수 있고, 나중에 백엔드에서
        // 값을 받게 바뀌어도 그쪽이 중복을 걸러준다는 보장이 없다.
        // 읽기 쪽이 유일한 관문이므로 여기서 전부 정리한다.
        return [...new Set(
            parsed.filter((n): n is number => typeof n === "number" && VALID_NOS.has(n)),
        )]
            // 상한이 생기기 전에 저장된 값이 더 많을 수 있다
            .slice(0, MAX_TALENT_SELECTION);
    } catch {
        return SELECTED_TALENT_NOS;
    }
}

function readSelection(jobId:string): number[] {
    const raw = window.localStorage.getItem(KeyOf(jobId));
    const hit = cache.get(jobId);
    if (hit&&hit.raw === raw) return hit.value;
    const value = parse(raw);
    cache.set(jobId, {raw, value});
    return value;
}

function subscribe(onChange: () => void): () => void {
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener("storage", onChange);
    };
}

/**이 공고에 선정된 인재상 번호 목록 */
export function useTalentSelection(jobId:string): number[] {
    const getSnapshot = useCallback(() => readSelection(jobId), [jobId]);
    // 서버 렌더 시점엔 localStorage가 없음 -> 기본값(2025년 예시)으로 그린다.
    const getServerSnapshot = useCallback(() => SELECTED_TALENT_NOS, []);
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 이 공고의 선택을 저장하고 같은 탭의 다른 화면에 알린다 */
export function saveTalentSelection(jobId: string, nos: number[]): void {
    // 팝업 UI 만 막으면 우회될 수 있으므로 저장 시점에도 상한을 보장한다
    const clean = [...new Set(nos)]
        .filter((n)=>VALID_NOS.has(n))
        .sort((a,b)=> a - b)
        .slice(0, MAX_TALENT_SELECTION);
    window.localStorage.setItem(KeyOf(jobId), JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}
