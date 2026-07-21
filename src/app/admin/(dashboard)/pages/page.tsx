import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreatePageForm } from "./create-page-form";

export const metadata: Metadata = {
  title: "Contenu des pages — Admin Blac_Kaleta",
};

export default async function PagesIndex() {
  const supabase = await createClient();
  const { data: pages } = await supabase
    .from("pages")
    .select("slug, title, show_in_menu")
    .order("title", { ascending: true });

  const pageList = pages ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Contenu des pages
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Crée une page ou choisis-en une pour modifier ses blocs (titre,
        texte, image).
      </p>

      <div className="mt-6">
        <CreatePageForm />
      </div>

      {pageList.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucune page pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100">
          {pageList.map((page) => (
            <li key={page.slug} className="flex items-center justify-between py-3">
              <Link
                href={`/admin/pages/${page.slug}`}
                className="text-sm font-medium hover:underline"
              >
                {page.title}
              </Link>
              <span className="text-xs text-zinc-500">
                /{page.slug} {page.show_in_menu ? "· dans le menu" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
