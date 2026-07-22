"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CartIcon } from "@/components/cart-icon";

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
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-zinc-100">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-10 lg:py-6">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center text-base font-bold tracking-wide"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain" />
          ) : (
            siteName
          )}
        </Link>

        <nav className="hidden items-center gap-6 lg:flex lg:gap-8">
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
          <CartIcon />
        </nav>

        <div className="flex items-center gap-4 lg:hidden">
          <CartIcon />
          <button
            type="button"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex h-9 w-9 flex-none items-center justify-center"
          >
            {open ? (
              <span className="text-2xl leading-none">×</span>
            ) : (
              <span className="flex flex-col gap-1.5">
                <span className="h-px w-6 bg-black" />
                <span className="h-px w-6 bg-black" />
                <span className="h-px w-6 bg-black" />
              </span>
            )}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="flex flex-col border-t border-zinc-100 px-4 py-2 lg:hidden">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                className={
                  isActive
                    ? "border-b border-zinc-100 py-3 text-sm font-semibold underline"
                    : "border-b border-zinc-100 py-3 text-sm text-zinc-800"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
