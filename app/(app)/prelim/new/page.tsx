import { redirect } from "next/navigation";

// 업로드 입구는 한 화면(PRELIM-003 CHG-002)
export default function PrelimNewPage() {
  redirect("/jobs/new");
}
