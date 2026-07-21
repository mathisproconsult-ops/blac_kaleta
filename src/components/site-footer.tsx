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
    <footer className="flex flex-col items-center gap-3 border-t border-zinc-100 px-4 py-6 text-center text-sm text-zinc-500 sm:flex-row sm:justify-between sm:px-6 sm:text-left lg:px-10">
      <p>{copyrightText}</p>
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
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
