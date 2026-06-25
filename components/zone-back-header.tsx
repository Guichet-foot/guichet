"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface ZoneBackHeaderProps {
  zoneName: string;
}

export function ZoneBackHeader({ zoneName }: ZoneBackHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 mb-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push(pathname)}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Toutes les zones
      </Button>
      <span className="text-sm text-muted-foreground">·</span>
      <span className="font-semibold text-brand">{zoneName}</span>
    </div>
  );
}
