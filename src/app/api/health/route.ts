import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "Variables d'environnement Supabase manquantes." },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    const body = await response.text();

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      supabaseUrl: url,
      anonKeyPrefix: anonKey.slice(0, 20),
      anonKeyLength: anonKey.length,
      body,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 },
    );
  }
}
