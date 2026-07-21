import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { deleteContactMessage } from "./actions";

export const metadata: Metadata = {
  title: "Messages — Admin Blac_Kaleta",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type MessageRow = {
  id: number;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contact_messages")
    .select("id, name, email, message, created_at")
    .order("created_at", { ascending: false })
    .returns<MessageRow[]>();

  const messages = data ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Messages
      </h1>

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      {messages.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun message pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100">
          {messages.map((message) => (
            <li key={message.id} className="flex items-start gap-4 py-4">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {message.name}{" "}
                  <span className="font-normal text-zinc-500">— {message.email}</span>
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-zinc-700">
                  {message.message}
                </p>
              </div>
              <p className="w-28 text-right text-xs text-zinc-500">
                {dateFormatter.format(new Date(message.created_at))}
              </p>
              <form action={deleteContactMessage.bind(null, message.id)}>
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Supprimer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
