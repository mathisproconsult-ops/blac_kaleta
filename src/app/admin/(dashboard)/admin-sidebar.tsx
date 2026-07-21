"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";

type LeafItem = { type: "link"; label: string; href: string; badge?: number };
type GroupItem = {
  type: "group";
  label: string;
  children: { label: string; href: string }[];
};
export type NavEntry = LeafItem | GroupItem;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  navItems,
  pathname,
  onNavigate,
}: {
  navItems: NavEntry[];
  pathname: string;
  onNavigate: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.type === "group") {
        initial[item.label] = item.children.some((child) =>
          isActive(pathname, child.href),
        );
      }
    }
    return initial;
  });

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
      {navItems.map((item) => {
        if (item.type === "link") {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={
                active
                  ? "flex items-center justify-between rounded bg-white/10 px-3 py-2 text-sm font-medium text-white"
                  : "flex items-center justify-between rounded px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
              }
            >
              {item.label}
              {item.badge ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-medium text-black">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        }

        const isOpen = openGroups[item.label] ?? false;
        return (
          <div key={item.label}>
            <button
              type="button"
              onClick={() =>
                setOpenGroups((state) => ({
                  ...state,
                  [item.label]: !state[item.label],
                }))
              }
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              {item.label}
              <span className={isOpen ? "rotate-90 transition-transform" : "transition-transform"}>
                ›
              </span>
            </button>
            {isOpen ? (
              <div className="ml-3 flex flex-col gap-1 border-l border-white/10 pl-3">
                {item.children.map((child) => {
                  const active = isActive(pathname, child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={
                        active
                          ? "rounded bg-white/10 px-3 py-2 text-sm font-medium text-white"
                          : "rounded px-3 py-2 text-sm text-zinc-300 hover:bg-white/10"
                      }
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminSidebar({
  navItems,
  email,
  logoutAction,
}: {
  navItems: NavEntry[];
  email: string | undefined;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const content = (
    <>
      <div className="mb-10">
        <p className="text-base font-bold tracking-wide">BLAC_KALETA</p>
        <p className="text-xs uppercase tracking-widest text-zinc-400">
          Admin dashboard
        </p>
      </div>
      <NavLinks
        navItems={navItems}
        pathname={pathname}
        onNavigate={() => setOpen(false)}
      />
      <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
        {email ? (
          <p className="truncate text-xs text-zinc-400">{email}</p>
        ) : null}
        <form action={logoutAction}>
          <SubmitButton pendingText="…" className="text-sm text-zinc-300 hover:text-white">
            Déconnexion
          </SubmitButton>
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
