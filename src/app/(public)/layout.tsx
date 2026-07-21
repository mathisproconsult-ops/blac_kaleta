import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, label, href")
    .order("position", { ascending: true });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader items={menuItems ?? []} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
