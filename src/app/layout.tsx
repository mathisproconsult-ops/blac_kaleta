import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blac_Kaleta",
  description: "Portfolio et boutique de l'artiste Blac_Kaleta",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
