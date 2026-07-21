"use client";

import { useState } from "react";
import Link from "next/link";

type NavItem = { label: string; href: string; badge?: number };

export function AdminSidebar({
  navItems,
  email,
  logoutAction,
}: {
  navItems: NavItem[];
  email: string | undefined;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const content = (
    <>
      <div className="mb-10">
        <p className="text-base font-bold tracking-wide">BLAC_KALETA</p>
        <p className="text-xs uppercase tracking-widest text-zinc-400">
          Admin dashboard
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
          >
            {item.label}
            {item.badge ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-medium text-black">
                {item.badge}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
      <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
        {email ? (
          <p className="truncate text-xs text-zinc-400">{email}</p>
        ) : null}
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm text-zinc-300 hover:text-white"
          >
            Déconnexion
          </button>
        </form>
        <Link href="/" className="text-sm text-zinc-300 hover:text-white">
          ← Retour au site
        </Link>
      </div>
    </>
  );

  return (
    <>
      <div className="flex items-center justify-between bg-[#111111] px-4 py-4 text-white lg:hidden">
        <p className="text-sm font-bold tracking-wide">BLAC_KALETA ADMIN</p>
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
              <span className="h-px w-6 bg-white" />
              <span className="h-px w-6 bg-white" />
              <span className="h-px w-6 bg-white" />
            </span>
          )}
        </button>
      </div>

      {open ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}

      <aside
        className={
          open
            ? "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#111111] px-6 py-8 text-white transition-transform duration-200 lg:hidden"
            : "fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col bg-[#111111] px-6 py-8 text-white transition-transform duration-200 lg:hidden"
        }
      >
        {content}
      </aside>

      <aside className="hidden w-60 flex-none flex-col bg-[#111111] px-6 py-8 text-white lg:flex">
        {content}
      </aside>
    </>
  );
}
