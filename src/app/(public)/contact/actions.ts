"use server";

import { createClient } from "@/lib/supabase/server";

export type ContactFormState = {
  success: boolean;
  error: string | null;
};

export async function sendContactMessage(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const name = formData.get("name");
  const email = formData.get("email");
  const message = formData.get("message");

  if (typeof name !== "string" || !name.trim()) {
    return { success: false, error: "Merci de renseigner votre nom." };
  }
  if (typeof email !== "string" || !email.trim()) {
    return { success: false, error: "Merci de renseigner votre email." };
  }
  if (typeof message !== "string" || !message.trim()) {
    return { success: false, error: "Merci de renseigner votre message." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert({
    name: name.trim(),
    email: email.trim(),
    message: message.trim(),
  });

  if (error) {
    return {
      success: false,
      error: "Impossible d'envoyer le message. Réessayez.",
    };
  }

  return { success: true, error: null };
}
