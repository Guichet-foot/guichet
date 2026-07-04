import { requireRole } from "@/lib/auth";
import { getAccessCard } from "@/lib/actions/carte-actions";
import { notFound } from "next/navigation";
import { CardViewer } from "./card-viewer";
import QRCode from "qrcode";

export const metadata = { title: "Carte d'accès" };

export default async function CarteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["super_admin", "admin_zone"]);
  const { id } = await params;

  const card = await getAccessCard(id);
  if (!card) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";
  const qrContent = `${appUrl}/carte/${card.qr_token}`;

  const qrDataUrl = await QRCode.toDataURL(qrContent, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Carte d&apos;accès</h1>
        <p className="text-muted-foreground text-sm mt-1">{card.full_name}</p>
      </div>
      <CardViewer card={card} qrDataUrl={qrDataUrl} printUrl={`/api/cartes/${id}/print`} />
    </div>
  );
}
