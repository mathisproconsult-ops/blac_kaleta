"use client";

export function SelectAllCheckbox({ formId }: { formId: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Tout sélectionner"
      onChange={(event) => {
        const checked = event.currentTarget.checked;
        document
          .querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${formId}"]`)
          .forEach((checkbox) => {
            checkbox.checked = checked;
          });
      }}
    />
  );
}
