import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [{ data: menuItems }, settings] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, label, href")
      .order("position", { ascending: true }),
    getSettings(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        items={menuItems ?? []}
        siteName={settings.shop_name}
        logoUrl={settings.header_logo_url}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
