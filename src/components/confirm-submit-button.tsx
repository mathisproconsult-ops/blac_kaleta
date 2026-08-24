"use client";

import type { ComponentProps } from "react";
import { SubmitButton } from "./submit-button";

// Bouton de formulaire qui demande une confirmation native du navigateur
// avant de laisser passer la soumission — pour toute action irréversible
// (suppression définitive) qui n'a pas de corbeille en filet de sécurité.
export function ConfirmSubmitButton({
  confirmMessage,
  onClick,
  ...props
}: ComponentProps<typeof SubmitButton> & { confirmMessage: string }) {
  return (
    <SubmitButton
      {...props}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
