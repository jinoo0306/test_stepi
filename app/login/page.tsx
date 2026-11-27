"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StepiLogo from "@/components/stepi-logo";
import loginBg from "@/public/login-bg.jpg";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  // 우리 사이트 안 경로만 허용 (//, /\ 는 다른 사이트로 갈 수 있음)
  const raw = params.get("next") ?? "";
  const next = /^\/(?![/\\])/.test(raw) ? raw : "/prelim";
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? "로그인에 실패하였습니다.");
        setLoading(false);
        return;
      }
      router.replace(next);
    } catch {
      setErr("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주십시오.");
      setLoading(false);
    }
  };

  return (
    <main className="stepi-login relative flex min-h-screen flex-col overflow-hidden bg-[var(--p-50)]">
      {/* 배경: Unsplash 무료 사진(7FqOISWr5V0)을 로고색 #373282 단계로 다시 칠한 그림, 천천히 확대·축소. 입력칸 초점은 주황 밑줄 대신 남색 테두리 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <style>{`
          html:has(.stepi-login) { scrollbar-gutter: auto }
          .stepi-login .input:focus { box-shadow: 0 0 0 1px var(--p-700) }
          @keyframes stepi-breathe { from { transform: scale(1) } to { transform: scale(1.05) translateX(-1%) } }
          .stepi-breathe { animation: stepi-breathe 18s ease-in-out infinite alternate }
          @media (prefers-reduced-motion: reduce) { .stepi-breathe { animation: none } }
        `}</style>
        <div className="stepi-breathe absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${loginBg.src})` }} />
      </div>

      <header className="relative z-10 px-6 sm:px-10 lg:px-16 pt-6 sm:pt-8">
        <StepiLogo size={56} />
      </header>

      <div className="relative z-10 flex w-full flex-1 flex-col justify-center gap-10 px-6 pb-12 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-16">
        <div className="hidden lg:block lg:w-1/2 lg:-mt-24">
          <h1 className="whitespace-nowrap text-[48px] xl:text-[56px] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--p-800)]">
            AI 채용지원 시스템
          </h1>
          <span className="mt-6 block h-1 w-14 rounded-full bg-[var(--s-500)]" />
          <p className="mt-5 text-[17px] text-[var(--p-600)]">AI 기반 직무적합성 분석 및 역량 진단 시스템</p>
        </div>

        <section className="w-full max-w-[420px] self-center lg:mx-auto rounded-2xl border border-white/70 bg-white/90 p-8 shadow-[0_24px_60px_-20px_rgba(27,26,64,0.35)] sm:p-10 lg:self-auto">
          <h1 className="mb-1 text-[13px] font-semibold text-[var(--p-500)] lg:hidden">AI 채용지원 시스템</h1>
          <h2 className="text-[22px] font-bold text-[var(--ink)]">로그인</h2>
          <p className="mt-2 mb-7 text-[14px] leading-[1.7] text-[var(--ink-muted)]">
            인사팀에 공유된 비밀번호를 입력해 주십시오.
          </p>

          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="block text-[13px] text-[var(--ink-muted)] mb-2">
                비밀번호
              </span>
              <input
                type="password"
                className="input"
                placeholder="비밀번호 입력"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onInput={(e) => setPw((e.target as HTMLInputElement).value)}
                autoFocus
                required
                autoComplete="current-password"
              />
            </label>
            {err && <p role="alert" className="text-[14px] text-[var(--bad)]">{err}</p>}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? "확인 중" : "로그인"}
            </button>
          </form>

          <p className="mt-7 border-t border-[var(--line)] pt-5 text-[12.5px] leading-[1.7] text-[var(--ink-muted)]">
            본 시스템은 채용 의사결정의 보조 지표로 사용되며, 최종 판단은 면접관이 합니다.
            본 시스템은 권한이 부여된 사용자만 이용할 수 있습니다. 비밀번호 분실 시 시스템 관리자에게 문의해 주십시오.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
