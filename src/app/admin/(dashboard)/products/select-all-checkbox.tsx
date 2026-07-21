"use client";

export function SelectAllCheckbox() {
  return (
    <input
      type="checkbox"
      aria-label="Tout sélectionner"
      onChange={(event) => {
        const checked = event.currentTarget.checked;
        document
          .querySelectorAll<HTMLInputElement>('input[name="ids"]')
          .forEach((checkbox) => {
            checkbox.checked = checked;
          });
      }}
    />
  );
}
