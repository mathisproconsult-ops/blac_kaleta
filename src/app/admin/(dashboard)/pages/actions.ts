"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RESERVED_SLUGS, slugify } from "@/lib/page-blocks";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function syncMenuItem(
  supabase: SupabaseClient,
  pageId: number,
  showInMenu: boolean,
  label: string,
  href: string,
) {
  const { data: existing } = await supabase
    .from("menu_items")
    .select("id")
    .eq("page_id", pageId)
    .maybeSingle();

  if (showInMenu) {
    if (existing) {
      await supabase
        .from("menu_items")
        .update({ label, href })
        .eq("id", existing.id);
    } else {
      const { data: last } = await supabase
        .from("menu_items")
        .select("position")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabase.from("menu_items").insert({
        label,
        href,
        position: (last?.position ?? -1) + 1,
        page_id: pageId,
      });
    }
  } else if (existing) {
    await supabase.from("menu_items").delete().eq("id", existing.id);
  }
}

function revalidatePublic(slug: string) {
  revalidatePath("/", "layout");
  revalidatePath(`/${slug}`);
}

export type CreatePageState = { error: string | null };

export async function createPage(
  _prevState: CreatePageState,
  formData: FormData,
): Promise<CreatePageState> {
  const title = formData.get("title");
  const slugInput = formData.get("slug");
  const showInMenu = formData.get("show_in_menu") === "on";

  if (typeof title !== "string" || !title.trim()) {
    return { error: "Merci de renseigner un titre." };
  }

  const slug = slugify(
    typeof slugInput === "string" && slugInput.trim() ? slugInput : title,
  );

  if (!slug) {
    return { error: "URL invalide." };
  }
  if (RESERVED_SLUGS.includes(slug)) {
    return { error: "Cette URL est réservée, choisis-en une autre." };
  }

  const supabase = await createClient();
  const { data: page, error } = await supabase
    .from("pages")
    .insert({ slug, title: title.trim(), show_in_menu: showInMenu })
    .select("id")
    .single();

  if (error || !page) {
    return {
      error:
        error?.code === "23505"
          ? "Cette URL est déjà utilisée par une autre page."
          : "Impossible de créer la page.",
    };
  }

  if (showInMenu) {
    await syncMenuItem(supabase, page.id, true, title.trim(), `/${slug}`);
  }

  revalidatePath("/admin/pages");
  revalidatePublic(slug);

  redirect(`/admin/pages/${slug}`);
}

export async function updatePageMeta(
  pageId: number,
  slug: string,
  formData: FormData,
) {
  const title = formData.get("title");
  const showInMenu = formData.get("show_in_menu") === "on";
  if (typeof title !== "string" || !title.trim()) return;

  const supabase = await createClient();
  await supabase
    .from("pages")
    .update({ title: title.trim(), show_in_menu: showInMenu })
    .eq("id", pageId);

  await syncMenuItem(supabase, pageId, showInMenu, title.trim(), `/${slug}`);

  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${slug}`);
  revalidatePublic(slug);
}

export async function deletePage(pageId: number, slug: string) {
  const supabase = await createClient();
  await supabase.from("pages").delete().eq("id", pageId);

  revalidatePath("/admin/pages");
  revalidatePublic(slug);
}
