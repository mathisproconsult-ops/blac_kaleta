-- Certaines œuvres du portfolio n'ont pas de prix (pas destinées à la vente)
alter table public.products alter column price drop not null;

alter table public.products drop constraint if exists products_price_check;
alter table public.products
  add constraint products_price_check check (price is null or price >= 0);
