"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";

type BoundAction = (formData: FormData) => Promise<void>;

export function ProductRowActions({
  isTrash,
  isVisible,
  productId,
  onTrash,
  onRestore,
  onDeletePermanently,
  onDuplicate,
  quickEditForm,
}: {
  isTrash: boolean;
  isVisible: boolean;
  productId: number;
  onTrash: BoundAction;
  onRestore: BoundAction;
  onDeletePermanently: BoundAction;
  onDuplicate: BoundAction;
  quickEditForm: ReactNode;
}) {
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
        {isTrash ? (
          <>
            <form action={onRestore}>
              <SubmitButton pendingText="…" className="hover:underline">
                Restaurer
              </SubmitButton>
            </form>
            <span>|</span>
            <form action={onDeletePermanently}>
              <SubmitButton pendingText="…" className="text-red-600 hover:underline">
                Supprimer définitivement
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <Link href={`/admin/products/${productId}`} className="hover:underline">
              Modifier
            </Link>
            <span>|</span>
            <button
              type="button"
              onClick={() => setQuickOpen((value) => !value)}
              className="hover:underline"
            >
              {quickOpen ? "Fermer" : "Modification rapide"}
            </button>
            <span>|</span>
            <form action={onTrash}>
              <SubmitButton pendingText="…" className="hover:underline">
                Corbeille
              </SubmitButton>
            </form>
            <span>|</span>
            {isVisible ? (
              <a
                href={`/boutique/${productId}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                Voir
              </a>
            ) : (
              <span className="text-zinc-300">Voir</span>
            )}
            <span>|</span>
            <form action={onDuplicate}>
              <SubmitButton pendingText="…" className="hover:underline">
                Dupliquer
              </SubmitButton>
            </form>
          </>
        )}
      </div>
      {quickOpen ? <div className="mt-3">{quickEditForm}</div> : null}
    </>
  );
}
