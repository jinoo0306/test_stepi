import TuringMonitor from "./turing-monitor";

export const dynamic = "force-dynamic";

export default async function TuringPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[]; period?: string | string[] }>;
}) {
  const { tab, period } = await searchParams;
  return (
    <TuringMonitor
      initialTab={tab === "history" ? "history" : "overview"}
      initialPeriod={period === "30d" || period === "all" ? period : "90d"}
    />
  );
}
