import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

const navItems = [
  { label: "Overview", href: "/admin" },
  { label: "Produits", href: "/admin/products" },
  { label: "Catégories", href: "/admin/categories" },
];

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims as { email?: string } | undefined)?.email;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-none flex-col bg-[#111111] px-6 py-8 text-white">
        <div className="mb-10">
          <p className="text-base font-bold tracking-wide">BLAC_KALETA</p>
          <p className="text-xs uppercase tracking-widest text-zinc-400">
            Admin dashboard
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
          {email ? (
            <p className="truncate text-xs text-zinc-400">{email}</p>
          ) : null}
          <form action={logout}>
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
      </aside>
      <main className="flex-1 bg-[#fafaf9] p-10">{children}</main>
    </div>
  );
}
