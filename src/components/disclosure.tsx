"use client";

import { useState, type ReactNode } from "react";

export function Disclosure({
  label,
  closeLabel = "Annuler",
  children,
  className,
}: {
  label: string;
  closeLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        {open ? closeLabel : label}
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
