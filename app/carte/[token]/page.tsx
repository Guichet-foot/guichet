import { getCardByQRToken } from "@/lib/actions/carte-actions";
import { notFound } from "next/navigation";
import { User, Phone, MapPin, Briefcase, Shield } from "lucide-react";

export const metadata = { title: "Carte d'accès — ODCAV" };

export default async function PublicCartePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const card = await getCardByQRToken(token);
  if (!card) notFound();

  const infoRows = [
    { Icon: User, label: "NOM COMPLET", value: card.full_name },
    { Icon: Phone, label: "TÉLÉPHONE", value: card.phone },
    { Icon: MapPin, label: "ZONE", value: card.zone_name },
    { Icon: Briefcase, label: "POSTE", value: card.poste },
    ...(card.asc_name ? [{ Icon: Shield, label: "ASC", value: card.asc_name }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* ODCAV Header */}
        <div className="text-center mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logoodcavdes.png"
            alt="ODCAV"
            className="h-20 w-auto mx-auto"
          />
          <p className="text-xs text-gray-500 mt-1">Guichet Foot — Navétane</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border-4 border-green-800 overflow-hidden shadow-xl">
          {/* Header */}
          <div className="bg-green-50 border-b-2 border-green-800 p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-bold text-green-800 uppercase tracking-wider">
                Carte d&apos;accès
              </p>
              <p className="text-sm font-bold text-green-700">Navétane 2025-2026</p>
            </div>
            {/* Photo */}
            <div className="w-16 h-16 rounded-full border-2 border-green-800 overflow-hidden bg-green-100 shrink-0">
              {card.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.photo_url}
                  alt={card.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="h-8 w-8 text-green-700" />
                </div>
              )}
            </div>
          </div>

          {/* Info rows */}
          <div className="divide-y divide-gray-100">
            {infoRows.map(({ Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-green-800 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-green-800 uppercase tracking-wider leading-none">
                    {label}
                  </p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-green-50 border-t border-green-200 px-4 py-2 text-center">
            <p className="text-[10px] text-green-700 font-medium">
              Carte officielle ODCAV · Navétane Sénégal
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Vérifié via Guichet Foot
        </p>
      </div>
    </div>
  );
}
