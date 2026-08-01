import { ImageUploadField } from "./image-upload-field";

type Category = { id: number; name: string };
type Technique = { id: number; name: string };
type AvailableMedia = { id: number; filename: string; url: string };
type OptionGroup = { id: number; name: string; selection_type: "single" | "multiple" };

export function ProductFields({
  categories,
  techniques,
  defaultValues,
  selectedCategoryIds,
  availableMedia,
  optionGroups,
  selectedOptionGroupIds,
}: {
  categories: Category[];
  techniques: Technique[];
  defaultValues?: {
    title: string;
    price: number | null;
    stock: number;
    description: string | null;
    year: number | null;
    technique_id: number | null;
    is_for_sale: boolean;
    show_in_recent_works: boolean;
    featured_home: boolean;
  };
  selectedCategoryIds?: number[];
  availableMedia?: AvailableMedia[];
  optionGroups?: OptionGroup[];
  selectedOptionGroupIds?: number[];
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
            defaultChecked={defaultValues ? defaultValues.is_for_sale : true}
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
          Prix (FCFA)
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
          Technique (pour Œuvres récentes)
        </label>
        <select
          name="technique_id"
          defaultValue={defaultValues?.technique_id ?? ""}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        >
          <option value="">Aucune</option>
          {techniques.map((technique) => (
            <option key={technique.id} value={technique.id}>
              {technique.name}
            </option>
          ))}
        </select>
        {techniques.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Aucune technique — crée-en une dans Techniques.
          </p>
        ) : null}
      </div>
      <ImageUploadField />
      {availableMedia && availableMedia.length > 0 ? (
        <fieldset className="flex flex-col gap-1 sm:col-span-2">
          <legend className="text-xs uppercase tracking-wide text-zinc-500">
            Ou choisir depuis la Médiathèque
          </legend>
          <div className="flex flex-wrap gap-3">
            {availableMedia.map((media) => (
              <label key={media.id} className="flex flex-col items-center gap-1 text-xs">
                <input type="checkbox" name="mediaIds" value={media.id} className="self-start" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={media.url}
                  alt={media.filename}
                  className="h-16 w-16 object-cover"
                />
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
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
      {optionGroups && optionGroups.length > 0 ? (
        <fieldset className="flex flex-col gap-1 sm:col-span-2">
          <legend className="text-xs uppercase tracking-wide text-zinc-500">
            Groupes d&apos;options applicables
          </legend>
          <div className="flex flex-wrap gap-3">
            {optionGroups.map((group) => (
              <label key={group.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="optionGroupIds"
                  value={group.id}
                  defaultChecked={selectedOptionGroupIds?.includes(group.id)}
                />
                {group.name}{" "}
                <span className="text-xs text-zinc-400">
                  ({group.selection_type === "single" ? "choix unique" : "choix multiples"})
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
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
