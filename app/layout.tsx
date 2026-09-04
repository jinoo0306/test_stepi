import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Pretendard Variable — 자체 호스팅.
 *
 * 전에는 globals.css 에서 jsDelivr CDN 을 @font-face 로 불렀는데 그 주소가 404 였다.
 * font-display: swap 이라 브라우저가 조용히 폴백 글꼴로 넘어가서, 에러 없이
 * 한 번도 적용되지 않은 채로 있었다. 파일을 저장소에 두고 next/font 에 맡긴다.
 *
 * variable 폰트라 파일 하나가 45~920 굵기를 전부 담는다. 굵기별 파일이 필요 없다.
 * 라이선스는 SIL OFL 1.1 — app/font/LICENSE.txt 에 함께 둔다.
 */
const pretendard = localFont({
  src: "./font/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  // globals.css 의 --font-sans 가 이 이름을 참조한다
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: "과학기술정책연구원 - 지원자 직무적합 분석",
  description: "AI 기반 직무적합성 분석 및 역량 진단 시스템",
  icons: { icon: [] },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
