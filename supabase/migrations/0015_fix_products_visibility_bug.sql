-- Bug : la case "En vente" était décochée par défaut à la création
-- (formulaire ET import CSV), donc tous les produits créés depuis
-- l'ajout de ce statut avaient is_for_sale = false et n'apparaissaient
-- jamais en Boutique. On corrige le défaut et on republie le
-- catalogue existant (l'admin peut ensuite décocher au cas par cas
-- les pièces qu'il ne veut pas vendre).
alter table public.products alter column is_for_sale set default true;

update public.products set is_for_sale = true where is_for_sale = false;
