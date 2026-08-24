"use client";

import { useState, type ReactNode } from "react";

interface Props {
  essayContent: ReactNode;
  paperContent: ReactNode;
  talentContent: ReactNode;
}

type Tab = "essay" | "paper" | "talent";

export default function DetailTabs({
  essayContent,
  paperContent,
  talentContent,
}: Props) {
  const [tab, setTab] = useState<Tab>("essay");
  // 한 번이라도 연 탭만 그린다.
  //
  // 전에는 세 탭을 다 그려 놓고 CSS 로 숨겼다. 그러면 인재상 탭을 열지 않는 사람도
  // 34유형 채점과 오각형 계산을 매 지원자 페이지마다 지불한다.
  // 한 번 연 뒤에는 숨기기만 해서, 다시 돌아왔을 때 펼침 상태가 남아 있게 한다.
  const [visited, setVisited] = useState<Tab[]>(["essay"]);

  const show = (next: Tab) => {
    setTab(next);
    setVisited((prev) => (prev.includes(next) ? prev : [...prev, next]));
  };

  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--line-strong)] mb-8 -mx-1">
        <TabButton active={tab === "essay"} onClick={() => show("essay")}>
          자기소개서 분석
        </TabButton>
        <TabButton active={tab === "paper"} onClick={() => show("paper")}>
          학술지 게재
        </TabButton>
        <TabButton active={tab === "talent"} onClick={() => show("talent")}>
          인재상 유형
        </TabButton>
      </div>
      <div className={tab === "essay" ? "block" : "hidden"}>
        {visited.includes("essay") && essayContent}
      </div>
      <div className={tab === "paper" ? "block" : "hidden"}>
        {visited.includes("paper") && paperContent}
      </div>
      <div className={tab === "talent" ? "block" : "hidden"}>
        {visited.includes("talent") && talentContent}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 text-[14px] transition border-b-2 -mb-[1px] ${
        active
          ? "border-[var(--secondary)] text-[var(--ink)] font-medium"
          : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}
