import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import { AdminSidebar, type NavEntry } from "./admin-sidebar";

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

  const navItems: NavEntry[] = [
    { type: "link", label: "Overview", href: "/admin" },
    { type: "link", label: "Commandes", href: "/admin/orders", badge: unreadOrders ?? 0 },
    {
      type: "group",
      label: "Vente",
      children: [
        { label: "Produits", href: "/admin/products" },
        { label: "Catégories", href: "/admin/categories" },
      ],
    },
    { type: "link", label: "Médias", href: "/admin/media" },
    { type: "link", label: "Clients", href: "/admin/customers" },
    { type: "link", label: "Messages", href: "/admin/messages" },
    {
      type: "group",
      label: "Réglages",
      children: [
        { label: "Menu", href: "/admin/menu" },
        { label: "Pied de page", href: "/admin/footer" },
        { label: "Contenu des pages", href: "/admin/pages" },
      ],
    },
    { type: "link", label: "Paramètres", href: "/admin/settings" },
  ];

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminSidebar navItems={navItems} email={email} logoutAction={logout} />
      <main className="flex-1 overflow-x-hidden bg-[#fafaf9] p-4 sm:p-6 lg:p-10">
        {children}
      </main>
    </div>
  );
}
