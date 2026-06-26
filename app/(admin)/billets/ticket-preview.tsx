"use client";

import { formatFCFA } from "@/lib/format";

interface TicketPreviewProps {
  name: string;
  price: number;
  color: string;
}

export function TicketPreview({ name, price, color }: TicketPreviewProps) {
  return (
    <div className="border border-dashed border-border rounded-lg p-3 bg-white">
      <div className="text-center space-y-1">
        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
          GUICHET FOOT
        </p>
        <div className="border-t border-dashed border-border my-1" />
        <p className="text-xs text-muted-foreground">Équipe A vs Équipe B</p>
        <div className="border-t border-dashed border-border my-1" />
        <p className="font-bold text-sm" style={{ color }}>
          {name}
        </p>
        <p className="font-bold text-lg">{formatFCFA(price)}</p>
        <div className="border-t border-dashed border-border my-1" />
        <div className="w-12 h-12 mx-auto bg-muted rounded flex items-center justify-center">
          <span className="text-[8px] text-muted-foreground">QR</span>
        </div>
        <p className="text-[8px] text-muted-foreground font-mono">
          GF-20260101-0001
        </p>
      </div>
    </div>
  );
}
