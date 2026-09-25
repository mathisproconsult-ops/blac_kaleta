import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSettings } from "@/lib/settings";
import { getActivePopups } from "@/lib/popups";
import { getMenuItems, getFooterLinks } from "@/lib/site-nav";
import { CartProvider } from "@/lib/cart-context";
import { PopupManager } from "./popup-manager";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuItems, footerLinks, settings, popups] = await Promise.all([
    getMenuItems(),
    getFooterLinks(),
    getSettings(),
    getActivePopups(),
  ]);

  return (
    <CartProvider>
      <div className="flex flex-col">
        <SiteHeader
          items={menuItems}
          siteName={settings.shop_name}
          logoUrl={settings.header_logo_url}
        />
        <main className="flex-1">{children}</main>
        <SiteFooter
          copyrightText={settings.footer_copyright_text}
          links={footerLinks}
        />
      </div>
      <PopupManager popups={popups} />
    </CartProvider>
  );
}
