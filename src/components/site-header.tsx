"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuItem = { id: number; label: string; href: string };

export function SiteHeader({
  items,
  siteName,
  logoUrl,
}: {
  items: MenuItem[];
  siteName: string;
  logoUrl: string | null;
}) {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between border-b border-zinc-100 px-10 py-6">
      <Link href="/" className="flex items-center text-base font-bold tracking-wide">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain" />
        ) : (
          siteName
        )}
      </Link>
      <nav className="flex items-center gap-8">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
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
