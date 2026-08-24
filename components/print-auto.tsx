"use client";

import { useEffect } from "react";

/**
 * 인쇄 화면이 열리면 브라우저 인쇄 대화상자를 자동으로 띄운다.
 *
 * 고정 지연으로는 안 된다. 레이더 차트(recharts)는 하이드레이션 뒤에 그려지고
 * 인재상 세트는 서버에서 따로 불러오므로, 느린 날에는 빈 그림이 인쇄된다.
 * 그래서 (1) 웹폰트 로딩과 (2) DOM 이 조용해지는 시점을 기다린 뒤 인쇄한다.
 * 무언가 계속 바뀌어 끝나지 않는 경우를 대비해 maxWaitMs 에서 잘라 인쇄한다.
 */
export default function PrintAuto({
  quietMs = 600,
  maxWaitMs = 10000,
}: {
  quietMs?: number;
  maxWaitMs?: number;
}) {
  useEffect(() => {
    let done = false;
    let quietTimer: ReturnType<typeof setTimeout>;
    let hardTimer: ReturnType<typeof setTimeout>;
    let observer: MutationObserver | undefined;

    const print = () => {
      if (done) return;
      done = true;
      clearTimeout(quietTimer);
      clearTimeout(hardTimer);
      observer?.disconnect();
      window.print();
    };

    const armQuietTimer = () => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(print, quietMs);
    };

    const start = () => {
      if (done) return;
      observer = new MutationObserver(armQuietTimer);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      armQuietTimer();
      hardTimer = setTimeout(print, maxWaitMs);
    };

    // 폰트가 늦게 붙으면 줄바꿈이 달라져 인쇄 뒤 레이아웃이 밀린다
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) fonts.ready.then(start).catch(start);
    else start();

    return () => {
      done = true;
      clearTimeout(quietTimer);
      clearTimeout(hardTimer);
      observer?.disconnect();
    };
  }, [quietMs, maxWaitMs]);

  return null;
}
