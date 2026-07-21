import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact — Blac_Kaleta",
};

const contactEmail = "contact@blac-kaleta.com";

export default function ContactPage() {
  return (
    <div className="px-10 py-12">
      <h1 className="text-2xl font-semibold uppercase tracking-wide">Contact</h1>
      <a href={`mailto:${contactEmail}`} className="mt-4 block text-sm text-zinc-600 hover:underline">
        {contactEmail}
      </a>
      <ContactForm />
    </div>
  );
}
