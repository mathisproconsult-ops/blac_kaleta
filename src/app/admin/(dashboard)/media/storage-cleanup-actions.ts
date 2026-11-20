"use server";

import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Nettoyage du stockage : les outils de retraitement (filigrane, qualité,
// re-traitement) créent à chaque passage de NOUVEAUX fichiers dans le bucket
// "products" sans supprimer les anciens. Ces copies orphelines ont fait
// dépasser le quota de 1 Go de l'offre gratuite Supabase (novembre 2026).
//
// Un fichier est considéré comme inutilisé si son chemin n'apparaît NULLE
// PART dans les données de l'application (toutes les tables, toutes les
// colonnes, sous forme de chemin brut ou d'URL). Par prudence :
//  - seuls les buckets de CLEANABLE_BUCKETS peuvent être nettoyés (les
//    originaux privés "artwork-originals" ne sont jamais touchés ici) ;
//  - les fichiers de moins de MIN_AGE_HOURS sont ignorés (un upload en
//    cours peut exister avant que sa ligne ne soit enregistrée) ;
//  - la moindre erreur de lecture d'une table annule tout (sinon un
//    fichier utilisé pourrait passer pour inutilisé) ;
//  - la suppression recalcule la liste au moment de supprimer et ne
//    supprime que les fichiers encore inutilisés à cet instant.

const CLEANABLE_BUCKETS = ["products"] as const;
export type CleanableBucket = (typeof CLEANABLE_BUCKETS)[number];

// Toutes les tables du schéma public : un chemin d'image peut être
// référencé depuis n'importe laquelle (produits, œuvres récentes, blocs de
// page, popups, réglages…). Toute nouvelle table doit être ajoutée ici.
const ALL_TABLES = [
  "categories",
  "contact_messages",
  "customers",
  "footer_links",
  "media",
  "menu_items",
  "option_choices",
  "option_groups",
  "order_items",
  "orders",
  "page_blocks",
  "pages",
  "popups",
  "product_categories",
  "product_images",
  "product_option_groups",
  "products",
  "recent_work_categories",
  "recent_work_media",
  "settings",
  "social_links",
  "techniques",
  "translation_cache",
];

const MIN_AGE_HOURS = 24;
const PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 100;

export type UnusedFile = { name: string; size: number };

export type ScanResult =
  | {
      ok: true;
      bucket: CleanableBucket;
      totalFiles: number;
      totalBytes: number;
      unused: UnusedFile[];
      unusedBytes: number;
    }
  | { ok: false; error: string };

async function requireAdmin(): Promise<SupabaseClient> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    throw new Error("Non autorisé.");
  }
  return supabase;
}

function isCleanableBucket(bucket: string): bucket is CleanableBucket {
  return (CLEANABLE_BUCKETS as readonly string[]).includes(bucket);
}

// Concatène le contenu de toutes les tables en un seul texte, dans lequel
// on cherchera chaque chemin de fichier.
async function loadAllReferences(supabase: SupabaseClient): Promise<string> {
  const chunks: string[] = [];
  for (const table of ALL_TABLES) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        throw new Error(`Lecture de la table « ${table} » impossible : ${error.message}`);
      }
      const rows = data ?? [];
      chunks.push(JSON.stringify(rows));
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return chunks.join("\n");
}

type StoredFile = { name: string; size: number; createdAt: string | null };

// Liste récursivement tous les fichiers d'un bucket (Storage ne liste qu'un
// dossier à la fois : les entrées sans id sont des sous-dossiers).
async function listAllFiles(
  supabase: SupabaseClient,
  bucket: string,
  prefix = "",
): Promise<StoredFile[]> {
  const files: StoredFile[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      throw new Error(`Lecture du stockage « ${bucket}/${prefix} » impossible : ${error.message}`);
    }
    const entries = data ?? [];
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        files.push(...(await listAllFiles(supabase, bucket, path)));
      } else {
        const size = Number((entry.metadata as { size?: number } | null)?.size ?? 0);
        files.push({ name: path, size, createdAt: entry.created_at ?? null });
      }
    }
    if (entries.length < PAGE_SIZE) break;
  }
  return files;
}

// Index rapide des noms de fichiers présents dans les données : évite de
// parcourir tout le texte pour chacun des milliers de fichiers.
const FILE_NAME_PATTERN = /[^\s"'\\/(),?#=&]+\.[A-Za-z0-9]{2,5}/g;

function buildFileNameIndex(references: string): Set<string> {
  const index = new Set<string>();
  for (const match of references.matchAll(FILE_NAME_PATTERN)) {
    index.add(match[0]);
    try {
      index.add(decodeURIComponent(match[0]));
    } catch {
      // Séquence %xx invalide : la forme brute suffit.
    }
  }
  return index;
}

function isReferenced(path: string, references: string, fileNames: Set<string>): boolean {
  const baseName = path.split("/").pop() ?? path;
  // Nom de fichier "simple" (sans espace ni caractère spécial, avec
  // extension) absent de l'index : il n'apparaît nulle part dans les
  // données. Les autres noms passent par la recherche complète ci-dessous.
  if (/^[^\s"'\\/(),?#=&]+\.[A-Za-z0-9]{2,5}$/.test(baseName) && !fileNames.has(baseName)) {
    return false;
  }
  if (references.includes(path)) return true;
  // Une URL publique peut contenir le chemin encodé (espaces, accents…).
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  if (encoded !== path && references.includes(encoded)) return true;
  // JSON.stringify échappe les "/" seulement dans de rares cas, mais un
  // chemin peut aussi avoir été enregistré avec des "\/".
  return references.includes(path.replaceAll("/", "\\/"));
}

function isOldEnough(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs >= MIN_AGE_HOURS * 60 * 60 * 1000;
}

async function computeUnused(supabase: SupabaseClient, bucket: CleanableBucket) {
  const references = await loadAllReferences(supabase);
  // Garde-fou : des tables vides ou illisibles feraient passer TOUS les
  // fichiers pour inutilisés.
  if (references.length < 1000) {
    throw new Error("Les données du site semblent vides : nettoyage annulé par sécurité.");
  }
  const fileNames = buildFileNameIndex(references);
  const files = await listAllFiles(supabase, bucket);
  const unused = files.filter(
    (file) => isOldEnough(file.createdAt) && !isReferenced(file.name, references, fileNames),
  );
  return { files, unused };
}

export async function scanUnusedFiles(bucket: string): Promise<ScanResult> {
  try {
    if (!isCleanableBucket(bucket)) {
      return { ok: false, error: "Ce dossier ne peut pas être nettoyé." };
    }
    const supabase = await requireAdmin();
    const { files, unused } = await computeUnused(supabase, bucket);
    return {
      ok: true,
      bucket,
      totalFiles: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      unused: unused.map(({ name, size }) => ({ name, size })),
      unusedBytes: unused.reduce((sum, file) => sum + file.size, 0),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue." };
  }
}

export type DeleteResult =
  | { ok: true; deleted: number; deletedBytes: number; skipped: number }
  | { ok: false; error: string };

// Supprime les fichiers demandés, mais seulement ceux qui sont ENCORE
// inutilisés au moment de la suppression (la liste est recalculée).
export async function deleteUnusedFiles(
  bucket: string,
  names: string[],
): Promise<DeleteResult> {
  try {
    if (!isCleanableBucket(bucket)) {
      return { ok: false, error: "Ce dossier ne peut pas être nettoyé." };
    }
    const supabase = await requireAdmin();
    const { unused } = await computeUnused(supabase, bucket);
    const stillUnused = new Map(unused.map((file) => [file.name, file.size]));
    const toDelete = names.filter((name) => stillUnused.has(name));

    let deleted = 0;
    let deletedBytes = 0;
    for (let i = 0; i < toDelete.length; i += DELETE_BATCH_SIZE) {
      const batch = toDelete.slice(i, i + DELETE_BATCH_SIZE);
      const { data, error } = await supabase.storage.from(bucket).remove(batch);
      if (error) {
        return {
          ok: false,
          error: `Suppression interrompue après ${deleted} fichier(s) : ${error.message}`,
        };
      }
      for (const removed of data ?? []) {
        deleted += 1;
        deletedBytes += stillUnused.get(removed.name) ?? 0;
      }
    }

    return { ok: true, deleted, deletedBytes, skipped: names.length - toDelete.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erreur inconnue." };
  }
}
