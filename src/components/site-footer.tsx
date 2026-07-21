import Link from "next/link";

type FooterLink = { id: number; label: string; href: string };

export function SiteFooter({
  copyrightText,
  links,
}: {
  copyrightText: string;
  links: FooterLink[];
}) {
  return (
    <footer className="flex items-center justify-between border-t border-zinc-100 px-10 py-6 text-sm text-zinc-500">
      <p>{copyrightText}</p>
      <div className="flex items-center gap-6">
        {links.map((link) => (
          <Link key={link.id} href={link.href} className="hover:underline">
            {link.label}
          </Link>
        ))}
        <Link href="/admin" className="hover:underline">
          Tableau de bord admin
        </Link>
      </div>
    </footer>
  );
}
