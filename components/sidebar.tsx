"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FilePlus2,
  Trash2,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Activity,
  ShieldAlert,
  Database,
  SlidersHorizontal,
  ListChecks,
  LogOut,
  Menu,
  type LucideIcon,
} from "lucide-react";
import StepiLogo from "./stepi-logo";
import TalentSelectModal from "./talent-select-modal";
import { useTalentSets, retryTalentSets, MAX_TALENT_SETS } from "@/lib/talent-selection";
import { clearApiToken } from "@/lib/api";

const STORAGE_KEY = "stepi-sidebar-collapsed";

// turing. 의 끝 점만 민트(int. 브랜드 색)로 칠함. 팔레트 밖 예외는 이 점뿐(TURING-001 FR-011)
const withDot = (label: string) =>
  label.endsWith(".") ? <span>{label.slice(0, -1)}<span className="text-[#40E0D0]">.</span></span> : label;

type NavLeaf = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean };
type Feature = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string; // 단일 기능은 헤더 자체가 링크
  match: (p: string) => boolean;
  children?: NavLeaf[];
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsedPref, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // 768px 미만에서는 사이드바를 숨기고 메뉴 버튼으로 겹쳐 엶. 열려 있을 때는 접힌 아이콘 모양을 쓰지 않음
  // 연 경로를 기억해 다른 화면으로 이동하면 저절로 닫힘
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const mobileOpen = openedAt === pathname;
  const setMobileOpen = (open: boolean) => setOpenedAt(open ? pathname : null);
  const collapsed = collapsedPref && !mobileOpen;

  // 분석작업 안에 있을 때만 인재상 메뉴를 띄움
  //   /jobs/{id}...  -> 분석 ID
  //   /jobs/new      -> 새 분석 만들기이므로 제외
  const jobMatch = pathname.match(/^\/jobs\/([^/]+)/);
  const jobId = jobMatch && jobMatch[1] !== "new" ? jobMatch[1] : null;
  const [talentOpen, setTalentOpen] = useState(false);
  const { sets: talentSets, status: talentStatus, isDefault: talentIsDefault } = useTalentSets(jobId ?? "");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "1") setCollapsed(true);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, collapsedPref ? "1" : "0");
  }, [collapsedPref, hydrated]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenedAt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // 세 개의 동급 기능. 「사전스크리닝검토」와 「지원자 분석」은 하위 탭을 가짐
  const features: Feature[] = [
    {
      key: "prelim",
      label: "사전스크리닝 검토",
      icon: ShieldAlert,
      match: (p) => p.startsWith("/prelim"),
      children: [
        {
          href: "/prelim",
          label: "분석 현황",
          icon: ShieldAlert,
          match: (p) =>
            p.startsWith("/prelim") &&
            !p.startsWith("/prelim/trash") &&
            !p.startsWith("/prelim/reference"),
        },
        {
          href: "/prelim/reference",
          label: "제척 기준 정보",
          icon: Database,
          match: (p) => p.startsWith("/prelim/reference"),
        },
        {
          href: "/prelim/trash",
          label: "삭제 항목",
          icon: Trash2,
          match: (p) => p.startsWith("/prelim/trash"),
        },
      ],
    },
    {
      key: "analysis",
      label: "지원자 분석",
      icon: LayoutDashboard,
      match: (p) => p.startsWith("/jobs") || p.startsWith("/trash") || p.startsWith("/talent"),
      children: [
        {
          href: "/jobs",
          label: "분석 현황",
          icon: LayoutDashboard,
          match: (p) => p.startsWith("/jobs") && p !== "/jobs/new",
        },
        {
          href: "/jobs/new",
          label: "신규 분석 생성",
          icon: FilePlus2,
          match: (p) => p === "/jobs/new",
        },
        {
          href: "/talent",
          label: "인재상 기준",
          icon: ListChecks,
          match: (p) => p.startsWith("/talent"),
        },
        {
          href: "/trash",
          label: "삭제 항목",
          icon: Trash2,
          match: (p) => p.startsWith("/trash"),
        },
      ],
    },
    {
      key: "turing",
      label: "turing.",
      icon: Activity,
      href: "/turing",
      match: (p) => p.startsWith("/turing"),
    },
  ];

  const utility: NavLeaf[] = [
    { href: "/settings", label: "표시 설정", icon: Settings, match: (p) => p.startsWith("/settings") },
  ];

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    clearApiToken();
    router.replace("/login");
  };

  const widthClass = collapsed ? "md:w-16" : "md:w-64 lg:w-72";

  // 모든 클릭 가능한 leaf 를 평탄화 (collapsed 아이콘 레일용)
  const allLeaves: NavLeaf[] = [
    ...features.flatMap((f) =>
      f.children ? f.children : f.href ? [{ href: f.href, label: f.label, icon: f.icon, match: f.match }] : [],
    ),
    ...utility,
  ];

  return (
    <>
    <div
      data-print-hide
      className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-12 px-3 border-b border-[var(--line-strong)] bg-[var(--bg)]"
    >
      <button
        onClick={() => setMobileOpen(true)}
        className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition p-1.5 rounded-md hover:bg-[var(--bg-2)]"
        title="메뉴 펼치기"
        aria-label="메뉴 펼치기"
        aria-expanded={mobileOpen}
      >
        <Menu size={20} />
      </button>
      <Link href="/prelim" title="사전스크리닝 검토">
        <StepiLogo size={24} variant="mark" />
      </Link>
    </div>
    {mobileOpen && (
      <div data-print-hide className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
    )}
    <aside
      data-print-hide
      className={`${mobileOpen ? "flex fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]" : "hidden"} md:flex ${widthClass} shrink-0 flex-col md:sticky md:top-0 md:h-screen border-r border-[var(--line-strong)] bg-[var(--bg)] transition-[width] duration-200`}
    >
      {/* 헤더: 로고, 접기 토글 */}
      <div
        className={`${collapsed ? "px-2 pt-4 pb-4 flex flex-col items-center gap-3" : "px-4 lg:px-5 pt-5 pb-5 flex items-start justify-between gap-2"} border-b border-[var(--line-strong)]`}
      >
        {!collapsed && (
          <Link href="/prelim" className="block min-w-0 flex-1" title="사전스크리닝 검토">
            {/* 접기 버튼을 뺀 남은 폭을 다 씀 (md 약 188px, lg 약 212px) */}
            <StepiLogo size={44} className="h-auto w-full" />
            <div className="mt-2.5 text-[12.5px] font-medium text-[var(--ink-muted)]">
              AI 채용지원 시스템
            </div>
          </Link>
        )}
        {collapsed && (
          <Link href="/prelim" title="사전스크리닝 검토">
            <StepiLogo size={28} variant="mark" />
          </Link>
        )}
        <button
          onClick={() => (mobileOpen ? setMobileOpen(false) : setCollapsed((v) => !v))}
          className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition p-1.5 rounded-md hover:bg-[var(--bg-2)] shrink-0"
          title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          aria-label={collapsed ? "expand sidebar" : "collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? "px-2 py-4 flex flex-col items-center gap-1" : "px-3 lg:px-4 py-5"}`}>
        {collapsed ? (
          allLeaves.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`flex items-center justify-center w-10 h-10 rounded-md transition ${
                  active
                    ? "text-[var(--ink)] bg-[var(--bg-2)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-2)]"
                }`}
              >
                <Icon size={19} strokeWidth={1.8} />
              </Link>
            );
          })
        ) : (
          features.map((f, idx) => {
            const FIcon = f.icon;
            const groupActive = f.match(pathname);
            return (
              <div key={f.key} className={idx > 0 ? "mt-2 pt-4 border-t border-[var(--line)]" : ""}>
                {/* 기능 헤더: 단일 기능은 링크, 「지원자 분석」은 섹션 라벨 */}
                {f.href ? (
                  <Link
                    href={f.href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[15.5px] font-semibold transition ${
                      groupActive
                        ? "text-[var(--ink)] bg-[var(--bg-2)]"
                        : "text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--bg-2)]"
                    }`}
                  >
                    <FIcon size={18} strokeWidth={2} className={groupActive ? "text-[var(--secondary-2)]" : ""} />
                    {withDot(f.label)}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-[15.5px] font-semibold text-[var(--ink)]">
                    <FIcon size={18} strokeWidth={2} className={groupActive ? "text-[var(--secondary-2)]" : "text-[var(--ink-muted)]"} />
                    {f.label}
                  </div>
                )}

                {/* 하위 탭 */}
                {f.children && (
                  <div className="mt-1 ml-[14px] pl-3 border-l border-[var(--line)] flex flex-col">
                    {f.children.map((c) => {
                      const active = c.match(pathname);
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          className={`-ml-px border-l-2 pl-3 py-2 text-[14.5px] transition ${
                            active
                              ? "border-[var(--secondary)] text-[var(--ink)] font-semibold"
                              : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
                          }`}
                        >
                          {c.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* 이 분석: 분석작업 안에서만 나타나는 상황별 메뉴.
            링크가 아니라 팝업을 여는 버튼이라 features/allLeaves 배열에 못 넣음 */}
        {jobId && (
          <div className={collapsed ? "" : "mt-2 pt-4 border-t border-[var(--line)]"}>
            {!collapsed && (
              <div className="px-2.5 pb-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
                이 분석
              </div>
            )}
            {/* 불러오기 전에는 못 열게 막음.
                이때 화면에 보이는 건 서버값이 아니라 기본 세트인데, 그대로 저장하면
                서버에 있던 진짜 값을 덮어씀. 실패했을 때도 같은 이유로 막음 */}
            <button
              onClick={() => setTalentOpen(true)}
              disabled={talentStatus !== "ready"}
              title={
                talentStatus === "loading"
                  ? "인재상을 불러오는 중입니다"
                  : talentStatus === "error"
                    ? "인재상을 불러오지 못하였습니다"
                    : "인재상 선택"
              }
              className={
                (collapsed
                  ? "flex items-center justify-center w-10 h-10 rounded-md text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-2)] transition"
                  : "flex w-full items-center gap-2.5 px-2.5 py-2 rounded-md text-[15.5px] font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--bg-2)] transition") +
                " disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              }
            >
              <SlidersHorizontal
                size={collapsed ? 19 : 18}
                strokeWidth={collapsed ? 1.8 : 2}
              />
              {!collapsed && (
                <>
                  인재상 선택
                  <span className="ml-auto text-[12.5px] font-medium tabular-nums text-[var(--ink-muted)]">
                    {talentStatus === "loading"
                      ? "불러오는 중"
                      : talentStatus === "error"
                        ? "불러오기 실패"
                        : talentIsDefault
                          ? "기본 예시"
                          : `${talentSets.length} / ${MAX_TALENT_SETS} 세트`}
                  </span>
                </>
              )}
            </button>
            {/* 실패했을 때 새로고침 없이 다시 시도할 길.
                loadOnce 는 한 분석에 한 번만 요청하므로 이 버튼이 유일한 출구임 */}
            {!collapsed && talentStatus === "error" && (
              <button
                onClick={() => retryTalentSets(jobId)}
                className="mt-1 w-full px-2.5 text-left text-[12.5px] text-[var(--secondary-2)] hover:underline"
              >
                다시 시도
              </button>
            )}
          </div>
        )}
      </nav>

      {/* 팝업: 열림 상태는 사이드바가 들고 있음 */}
      {jobId && talentOpen && (
        <TalentSelectModal
          jobId={jobId}
          current={talentSets}
          onClose={() => setTalentOpen(false)}
        />
      )}

      {/* 하단: 관리 메뉴 + 로그아웃 */}
      <div className={`${collapsed ? "px-2 py-4 flex flex-col items-center gap-2" : "px-3 lg:px-4 py-4"} border-t border-[var(--line-strong)]`}>
        {collapsed ? (
          <button
            onClick={logout}
            title="로그아웃"
            className="text-[var(--ink-muted)] hover:text-[var(--bad)] transition p-2 rounded-md hover:bg-[var(--bg-2)]"
          >
            <LogOut size={18} strokeWidth={1.8} />
          </button>
        ) : (
          <>
            <div className="flex flex-col">
              {utility.map(({ href, label, icon: Icon, match }) => {
                const active = match(pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[14px] transition ${
                      active
                        ? "text-[var(--ink)] bg-[var(--bg-2)] font-medium"
                        : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-2)]"
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.8} />
                    {label}
                  </Link>
                );
              })}
            </div>
            <button
              onClick={logout}
              className="mt-1 flex items-center gap-2.5 px-2.5 py-2 w-full rounded-md text-[14px] text-[var(--ink-muted)] hover:text-[var(--bad)] hover:bg-[var(--bg-2)] transition"
            >
              <LogOut size={15} strokeWidth={1.8} />
              로그아웃
            </button>
          </>
        )}
      </div>
    </aside>
    </>
  );
}
