import Link from "next/link";

type Tab = "zone" | "c3" | "odcav";

const TABS: { value: Tab; label: string }[] = [
  { value: "zone", label: "Zone" },
  { value: "c3", label: "C3 (Communal)" },
  { value: "odcav", label: "ODCAV" },
];

export function OdcavDashboardTabs({ active, period }: { active: Tab; period: string }) {
  return (
    <div className="flex border-b border-border overflow-x-auto print:hidden">
      {TABS.map((t) => {
        const qs = new URLSearchParams({ tab: t.value });
        if (period && period !== "today") qs.set("period", period);
        return (
          <Link
            key={t.value}
            href={`/dashboard?${qs.toString()}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              active === t.value
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
