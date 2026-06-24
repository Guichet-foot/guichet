"use client";

import { useState } from "react";

interface TournamentTabsProps {
  poulesContent: React.ReactNode;
  calendrierContent: React.ReactNode;
  classementsContent: React.ReactNode;
}

const tabs = [
  { key: "poules", label: "Poules" },
  { key: "calendrier", label: "Calendrier & Résultats" },
  { key: "classements", label: "Classements" },
];

export function TournamentTabs({
  poulesContent,
  calendrierContent,
  classementsContent,
}: TournamentTabsProps) {
  const [active, setActive] = useState("poules");

  return (
    <div className="space-y-4">
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active === tab.key
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active === "poules" && poulesContent}
      {active === "calendrier" && calendrierContent}
      {active === "classements" && classementsContent}
    </div>
  );
}
