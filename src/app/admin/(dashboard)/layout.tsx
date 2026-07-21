import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import { AdminSidebar } from "./admin-sidebar";

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
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminSidebar navItems={navItems} email={email} logoutAction={logout} />
      <main className="flex-1 overflow-x-hidden bg-[#fafaf9] p-4 sm:p-6 lg:p-10">
        {children}
      </main>
    </div>
  );
}
