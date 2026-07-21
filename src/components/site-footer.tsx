import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="flex items-center justify-between border-t border-zinc-100 px-10 py-6 text-sm text-zinc-500">
      <p>© {new Date().getFullYear()} Blac_Kaleta</p>
      <Link href="/admin" className="hover:underline">
        Tableau de bord admin
      </Link>
    </footer>
  );
}
