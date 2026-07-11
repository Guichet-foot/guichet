import Link from "next/link";

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? "border-brand text-brand"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      {label}
    </Link>
  );
}

export function FinancesOdcavTabs({
  active,
}: {
  active: "zone" | "communal" | "departemental";
}) {
  return (
    <div className="flex border-b border-border overflow-x-auto print:hidden">
      <TabLink href="/finances" active={active === "zone"} label="Zone" />
      <TabLink href="/finances/inter?type=communal" active={active === "communal"} label="Communal" />
      <TabLink href="/finances/inter?type=departemental" active={active === "departemental"} label="Départemental" />
    </div>
  );
}
