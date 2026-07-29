import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DURATION_SECONDS, signSession } from "@/lib/auth";

export const runtime = "nodejs";

// simple constant-time-ish compare
function compare(got: string, expected: string): boolean {
  let same = got.length === expected.length;
  for (let i = 0; i < Math.max(got.length, expected.length); i++) {
    if (got.charCodeAt(i) !== expected.charCodeAt(i)) same = false;
  }
  return same;
}

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const accepted = [process.env.AUTH_PASSWORD, process.env.AUTH_PASSWORD_2].filter(
    (p): p is string => !!p,
  );
  const secret = process.env.SESSION_SECRET ?? "";
  if (accepted.length === 0 || !secret) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  const got = body.password ?? "";
  // every candidate is checked even after a match, so timing does not leak which one it was
  let same = false;
  for (const expected of accepted) {
    if (compare(got, expected)) same = true;
  }
  if (!same) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  const exp = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const token = await signSession(exp, secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  return res;
}
