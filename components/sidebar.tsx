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
  LogOut,
  type LucideIcon,
} from "lucide-react";
import StepiLogo from "./stepi-logo";

const STORAGE_KEY = "stepi-sidebar-collapsed";

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
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "1") setCollapsed(true);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed, hydrated]);

  // 세 개의 동급 기능. 「지원자 분석」만 하위 탭(대시보드 / 새 분석)을 가진다.
  const features: Feature[] = [
    {
      key: "analysis",
      label: "지원자 분석",
      icon: LayoutDashboard,
      match: (p) => p === "/" || p.startsWith("/jobs") || p.startsWith("/trash"),
      children: [
        {
          href: "/",
          label: "대시보드",
          icon: LayoutDashboard,
          match: (p) => p === "/" || (p.startsWith("/jobs") && p !== "/jobs/new"),
        },
        {
          href: "/jobs/new",
          label: "새 분석",
          icon: FilePlus2,
          match: (p) => p === "/jobs/new",
        },
        {
          href: "/trash",
          label: "휴지통",
          icon: Trash2,
          match: (p) => p.startsWith("/trash"),
        },
      ],
    },
    {
      key: "prelim",
      label: "사전스크리닝검토",
      icon: ShieldAlert,
      href: "/prelim",
      match: (p) => p.startsWith("/prelim"),
    },
    {
      key: "turing",
      label: "Turing",
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
    <aside
      className={`hidden md:flex ${widthClass} shrink-0 flex-col md:sticky md:top-0 md:h-screen border-r border-[var(--line-strong)] bg-[var(--bg)] transition-[width] duration-200`}
    >
      {/* 헤더 — 로고 + 접기 토글 */}
      <div
        className={`${collapsed ? "px-2 pt-4 pb-4 flex flex-col items-center gap-3" : "px-5 lg:px-6 pt-5 pb-5 flex items-start justify-between gap-3"} border-b border-[var(--line-strong)]`}
      >
        {!collapsed && (
          <Link href="/" className="block flex-1" title="대시보드">
            <StepiLogo size={26} />
            <div className="mt-2.5 text-[12.5px] font-medium text-[var(--ink-muted)]">
              지원자 직무적합성 분석
            </div>
          </Link>
        )}
        {collapsed && (
          <Link href="/" title="대시보드">
            <StepiLogo size={22} />
          </Link>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition p-1.5 rounded-md hover:bg-[var(--bg-2)] shrink-0"
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
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
                {/* 기능 헤더 — 단일 기능은 링크, 「지원자 분석」은 섹션 라벨 */}
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
                    {f.label}
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
      </nav>

      {/* 하단 — 관리 메뉴 + 로그아웃 */}
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
  );
}
