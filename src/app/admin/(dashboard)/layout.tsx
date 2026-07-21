import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims as { email?: string } | undefined)?.email;

  const { count: unreadOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("read", false);

  const navItems = [
    { label: "Overview", href: "/admin" },
    { label: "Commandes", href: "/admin/orders", badge: unreadOrders ?? 0 },
    { label: "Œuvres", href: "/admin/products" },
    { label: "Médias", href: "/admin/media" },
    { label: "Catégories", href: "/admin/categories" },
    { label: "Clients", href: "/admin/customers" },
    { label: "Messages", href: "/admin/messages" },
    { label: "Menu", href: "/admin/menu" },
    { label: "Pied de page", href: "/admin/footer" },
    { label: "Contenu des pages", href: "/admin/pages" },
    { label: "Paramètres", href: "/admin/settings" },
  ];

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
