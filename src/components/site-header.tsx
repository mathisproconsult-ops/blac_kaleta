"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Accueil", href: "/" },
  { label: "À propos", href: "/a-propos" },
  { label: "Œuvres récentes", href: "/oeuvres-recentes" },
  { label: "Boutique", href: "/boutique" },
  { label: "Contact", href: "/contact" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between border-b border-zinc-100 px-10 py-6">
      <Link href="/" className="text-base font-bold tracking-wide">
        BLAC_KALETA
      </Link>
      <nav className="flex items-center gap-8">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? "text-sm font-semibold underline"
                  : "text-sm text-zinc-800 hover:underline"
              }
            >
              {item.label}
            </Link>
          );
        })}
        <span className="h-5 w-px bg-zinc-200" aria-hidden />
        <Link href="/panier" aria-label="Panier" className="text-lg">
          🛒
        </Link>
      </nav>
    </header>
  );
}
