import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  /** 상단 컨텍스트 라벨 (예: 지원자 분석) */
  eyebrow?: string;
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** 우측 액션/통계 클러스터 */
  aside?: ReactNode;
  /** 뒤로가기 링크 */
  back?: { href: string; label: string };
}

export default function PageHeader({ eyebrow, icon: Icon, title, description, aside, back }: Props) {
  return (
    <header className="relative">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-[13.5px] text-[var(--ink-muted)] hover:text-[var(--ink)] mb-5 transition"
        >
          <ChevronLeft size={15} /> {back.label}
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pb-5">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="flex items-center gap-2.5 mb-3">
              <span className="h-4 w-[3px] rounded-full bg-[var(--secondary)]" />
              {Icon && <Icon size={15} strokeWidth={2} className="text-[var(--secondary-2)]" />}
              <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                {eyebrow}
              </span>
            </div>
          )}
          <h1 className="text-[clamp(27px,3.1vw,34px)] font-bold tracking-[-0.02em] leading-[1.12] text-[var(--ink)]">
            {title}
          </h1>
          {description && (
            <p className="mt-3 text-[15px] leading-[1.7] text-[var(--ink-muted)] max-w-[64ch]">
              {description}
            </p>
          )}
        </div>

        {aside && <div className="shrink-0 flex flex-col items-end gap-3">{aside}</div>}
      </div>

      {/* 시그니처 베이스라인 — 골드 세그먼트 + 풀폭 라인 */}
      <div className="relative h-[3px] w-full bg-[var(--line)]">
        <span className="absolute left-0 top-0 h-[3px] w-20 bg-[var(--secondary)]" />
      </div>
    </header>
  );
}
