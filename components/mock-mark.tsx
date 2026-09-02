import { AlertTriangle } from "lucide-react";

/**
 * 아직 개발되지 않은 값에 붙이는 배지. 카드 제목 옆에 단다.
 * 문구는 어디서나 같아야 하므로 바꿀 수 없게 두었다.
 */
export function MockBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-[var(--bad)] bg-[#FBEDED] px-3 py-[5px] text-[14px] font-bold leading-none text-[var(--bad)] align-middle">
      <AlertTriangle size={15} aria-hidden="true" />
      미개발, 예시 데이터
    </span>
  );
}

