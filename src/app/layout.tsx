import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blac_Kaleta",
  description: "Portfolio et boutique de l'artiste Blac_Kaleta",
};

// Applique le thème avant le premier rendu (localStorage, sinon préférence
// système) pour éviter un flash du mauvais thème (FOUC).
const themeInitScript = `
  (function () {
    try {
      var stored = localStorage.getItem("theme");
      var isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) document.documentElement.classList.add("dark");
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        {children}
      </body>
    </html>
  );
}
