type Category = { id: number; name: string };

export function ProductFields({
  categories,
  defaultValues,
  selectedCategoryIds,
}: {
  categories: Category[];
  defaultValues?: {
    title: string;
    price: number | null;
    stock: number;
    description: string | null;
    year: number | null;
    series: string | null;
    technique: string | null;
    is_for_sale: boolean;
    show_in_recent_works: boolean;
    featured_home: boolean;
  };
  selectedCategoryIds?: number[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="text-xs uppercase tracking-wide text-zinc-500">
          Visibilité
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_for_sale"
            defaultChecked={defaultValues?.is_for_sale ?? false}
          />
          En vente (apparaît dans la Boutique, avec prix et stock)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="show_in_recent_works"
            defaultChecked={defaultValues?.show_in_recent_works ?? false}
          />
          Afficher dans Œuvres récentes
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="featured_home"
            defaultChecked={defaultValues?.featured_home ?? false}
          />
          Mettre en avant sur l&apos;accueil
        </label>
      </fieldset>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Titre
        </label>
        <input
          name="title"
          required
          defaultValue={defaultValues?.title}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Prix (€)
        </label>
        <input
          name="price"
          type="number"
          min="0"
          step="0.01"
          defaultValue={defaultValues?.price ?? undefined}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Stock
        </label>
        <input
          name="stock"
          type="number"
          min="0"
          step="1"
          defaultValue={defaultValues?.stock ?? 0}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Année (pour Œuvres récentes)
        </label>
        <input
          name="year"
          type="number"
          min="1900"
          max="2100"
          step="1"
          defaultValue={defaultValues?.year ?? undefined}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Série (pour Œuvres récentes)
        </label>
        <input
          name="series"
          defaultValue={defaultValues?.series ?? undefined}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Technique (pour Œuvres récentes)
        </label>
        <input
          name="technique"
          defaultValue={defaultValues?.technique ?? undefined}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Photos
        </label>
        <input
          name="images"
          type="file"
          accept="image/*"
          multiple
          className="text-sm"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Description (optionnelle)
        </label>
        <textarea
          name="description"
          rows={3}
          defaultValue={defaultValues?.description ?? ""}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <fieldset className="flex flex-col gap-1 sm:col-span-2">
        <legend className="text-xs uppercase tracking-wide text-zinc-500">
          Catégories
        </legend>
        {categories.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Aucune catégorie — crée-en une dans Catégories.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={category.id}
                  defaultChecked={selectedCategoryIds?.includes(category.id)}
                />
                {category.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
