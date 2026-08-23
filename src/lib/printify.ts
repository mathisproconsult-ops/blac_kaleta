// Client minimal pour l'API Printify v1 (https://api.printify.com/v1) — ne
// couvre que ce dont le dashboard a besoin : lister les produits d'une
// boutique pour la synchronisation. Auth par jeton personnel en Bearer.

const PRINTIFY_API_BASE = "https://api.printify.com/v1";

export type PrintifyOptionValue = {
  id: number;
  title: string;
};

export type PrintifyOption = {
  name: string;
  type: string;
  values: PrintifyOptionValue[];
};

export type PrintifyVariant = {
  id: number;
  title: string;
  price: number;
  is_enabled: boolean;
  is_default: boolean;
  is_available: boolean;
  options: number[];
};

export type PrintifyImage = {
  src: string;
  variant_ids: number[];
  position: string;
  is_default: boolean;
};

export type PrintifyProduct = {
  id: string;
  title: string;
  description: string;
  options: PrintifyOption[];
  variants: PrintifyVariant[];
  images: PrintifyImage[];
  visible: boolean;
};

export class PrintifyApiError extends Error {}

async function printifyFetch<T>(
  path: string,
  apiKey: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${PRINTIFY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "Blac_Kaleta",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new PrintifyApiError(
      `Printify API ${response.status} sur ${path}${body ? ` : ${body.slice(0, 300)}` : ""}`,
    );
  }

  return (await response.json()) as T;
}

export async function listShopProducts(
  apiKey: string,
  shopId: string,
): Promise<PrintifyProduct[]> {
  const products: PrintifyProduct[] = [];
  let page = 1;

  // L'API pagine (max_pages non documenté côté client) : on avance tant
  // qu'une page pleine revient, avec un plafond de sécurité contre une
  // boucle infinie si la pagination répond de façon inattendue.
  for (let safety = 0; safety < 50; safety += 1) {
    const data = await printifyFetch<{ data: PrintifyProduct[]; last_page: number }>(
      `/shops/${shopId}/products.json?page=${page}&limit=50`,
      apiKey,
    );
    products.push(...data.data);
    if (page >= data.last_page || data.data.length === 0) break;
    page += 1;
  }

  return products;
}
