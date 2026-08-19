/**
 * 서버 렌더 시점의 현재 시각.
 *
 * `Date.now()` 를 컴포넌트 본문에서 직접 부르면 eslint 의 react-hooks/purity 가 막는다.
 * 렌더가 여러 번 일어나는 클라이언트 컴포넌트에서는 그 경고가 옳다 —
 * 호출할 때마다 값이 달라져 서버 HTML 과 브라우저 렌더가 어긋날 수 있기 때문.
 *
 * 다만 이 함수는 **서버 컴포넌트 전용**이다. 서버 컴포넌트는 브라우저에서 다시 렌더되지 않고,
 * 지원자 상세 페이지는 `export const dynamic = "force-dynamic"` 이라 요청마다 새로 그려진다.
 * 즉 "요청 시점의 현재 시각"을 읽는 것이 의도된 동작이며 불일치가 생기지 않는다.
 *
 * 클라이언트 컴포넌트(`"use client"`)에서는 쓰지 말 것 — 그 경우엔 useEffect 로 읽어야 한다.
 */
export function serverNow(): number {
  return Date.now();
}
