"use client";

import { Settings as SettingsIcon } from "lucide-react";
import { useDisplaySettings } from "@/lib/display-settings";
import PageHeader from "@/components/page-header";

export default function SettingsPage() {
  const { settings, update, hydrated } = useDisplaySettings();

  return (
    <div className="px-8 lg:px-12 py-9 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="환경 설정"
        icon={SettingsIcon}
        title="표시 설정"
        description="이 설정은 이 브라우저에만 저장됩니다. 다른 PC나 시크릿 창에는 적용되지 않습니다."
      />

      <section className="mt-8 panel">
        <div className="flex items-center gap-2.5 pb-3.5 mb-2 border-b border-[var(--line)]">
          <span className="mark" />
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--ink)]">지원자 상세 화면</h2>
        </div>

        <label className="flex items-start justify-between gap-6 py-4 cursor-pointer">
          <div>
            <div className="text-[15px] font-medium text-[var(--ink)]">추천 면접 질문 표시</div>
            <div className="mt-1.5 text-[13px] text-[var(--ink-muted)] leading-[1.65]">
              꺼두면 지원자 상세 화면의 &quot;추천 면접 질문&quot; 카드가 숨겨집니다.
              서류평가 단계에서 면접 질문이 평가에 영향을 주지 않게 하고 싶을 때 사용하세요.
            </div>
          </div>
          <input
            type="checkbox"
            disabled={!hydrated}
            checked={settings.showInterviewQuestions}
            onChange={(e) => update({ showInterviewQuestions: e.target.checked })}
            className="mt-1 h-5 w-5 accent-[var(--secondary)] shrink-0"
          />
        </label>
      </section>
    </div>
  );
}
