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

  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--line-strong)] mb-8 -mx-1">
        <TabButton active={tab === "essay"} onClick={() => setTab("essay")}>
          자기소개서 분석
        </TabButton>
        <TabButton active={tab === "paper"} onClick={() => setTab("paper")}>
          학술지 게재
        </TabButton>
        <TabButton active={tab === "talent"} onClick={() => setTab("talent")}>
          인재상 유형
        </TabButton>
      </div>
      <div className={tab === "essay" ? "block" : "hidden"}>{essayContent}</div>
      <div className={tab === "paper" ? "block" : "hidden"}>{paperContent}</div>
      <div className={tab === "talent" ? "block" : "hidden"}>{talentContent}</div>
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
