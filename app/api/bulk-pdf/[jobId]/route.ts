import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * 지원자 PDF 일괄 다운로드 시작.
 *
 * 이 한 단계만 프론트엔드를 거치는 이유는 세션 쿠키 때문이다. 렌더러가 인쇄 화면을
 * 열려면 로그인된 상태여야 하는데, 쿠키가 httpOnly 라 브라우저 JS 는 값을 읽지 못한다.
 * 서버에서만 읽을 수 있으므로 여기서 꺼내 백엔드로 넘긴다.
 * 비밀번호를 백엔드에 복제해 두는 방식보다 안전하고, 권한도 누른 사람 것으로 정확히 제한된다.
 *
 * 진행률 확인과 ZIP 내려받기는 백엔드를 직접 부른다. 특히 ZIP 은 지원자 수만큼 커져서
 * 서버리스 응답 한도에 걸리므로 이쪽을 거치면 안 된다.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase) {
    return NextResponse.json({ error: "API 주소가 설정되지 않았습니다." }, { status: 500 });
  }

  const res = await fetch(
    `${apiBase.replace(/\/$/, "")}/analysis-jobs/${encodeURIComponent(jobId)}/applicants-report`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_cookie: token }),
      cache: "no-store",
    },
  ).catch(() => null);

  if (!res) {
    return NextResponse.json({ error: "백엔드에 연결하지 못했습니다." }, { status: 502 });
  }
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json({ error: text.slice(0, 500) }, { status: res.status });
  }
  return new NextResponse(text, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
