"use client";

import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";
import { createSocialLink, type SocialLinkState } from "./social-actions";

const initialState: SocialLinkState = { success: false, error: null };

export function SocialLinkForm() {
  const [state, formAction] = useActionState(createSocialLink, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="flex flex-col gap-2">
      <form
        ref={formRef}
        action={formAction}
        autoComplete="off"
        className="flex flex-wrap items-end gap-2"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Réseau</label>
          <select
            name="platform"
            defaultValue=""
            required
            autoComplete="off"
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          >
            <option value="" disabled>
              Choisir…
            </option>
            {SOCIAL_PLATFORMS.map((platform) => (
              <option key={platform.key} value={platform.key}>
                {platform.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Lien</label>
          <input
            name="url"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="https://..."
            required
            className="w-full border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
        </div>
        <SubmitButton
          pendingText="Ajout…"
          className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + Ajouter
        </SubmitButton>
      </form>
      <div aria-live="polite">
        {state.error ? (
          <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            ⚠ {state.error}
          </p>
        ) : state.success ? (
          <p className="border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            ✓ Réseau ajouté.
          </p>
        ) : null}
      </div>
    </div>
  );
}
