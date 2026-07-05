import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Guichet Foot",
    template: "%s | Guichet Foot",
  },
  description: "Le guichet du Navétane — billetterie en 2 clics",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/icon-512.png",
  },
  openGraph: {
    title: "Guichet Foot",
    description: "Le guichet du Navétane — billetterie en 2 clics",
    url: "https://guichetfoot.com",
    siteName: "Guichet Foot",
    images: [
      {
        url: "https://guichetfoot.com/imagelogin.png",
        width: 1200,
        height: 630,
        alt: "Guichet Foot",
      },
    ],
    locale: "fr_SN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Guichet Foot",
    description: "Le guichet du Navétane — billetterie en 2 clics",
    images: ["https://guichetfoot.com/imagelogin.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0D5C3F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} ${sora.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased">
        {children}
        <Toaster position="top-center" richColors duration={1500} />
      </body>
    </html>
  );
}
