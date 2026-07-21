import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      {
        ok: false,
        checkedAt,
        error: "Variables d'environnement Supabase manquantes.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      cache: "no-store",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    const body = await response.text();

    return NextResponse.json(
      {
        ok: response.ok,
        checkedAt,
        status: response.status,
        supabaseUrl: url,
        anonKeyPrefix: anonKey.slice(0, 20),
        anonKeyLength: anonKey.length,
        body,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        checkedAt,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
