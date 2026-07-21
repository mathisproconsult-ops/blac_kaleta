# Blac_Kaleta

Site portfolio & boutique pour l'artiste Blac_Kaleta.

## Stack

- **Frontend/Backend** : Next.js 16 (App Router)
- **Base de données** : Supabase (Postgres)
- **Déploiement** : Vercel
- **Langue** : français partout (site public + dashboard admin)

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Variables d'environnement

Copier `.env.example` vers `.env.local` et renseigner les valeurs depuis le
dashboard Supabase (Project Settings → API) :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Ces mêmes variables doivent être ajoutées dans Vercel (Project Settings →
Environment Variables) avant le déploiement.

## Vérifier la connexion Supabase

Une route de contrôle est disponible : [http://localhost:3000/api/health](http://localhost:3000/api/health).

Elle doit répondre `{"ok":true,"status":200,...}`. Si elle répond `ok:false`,
vérifier les variables d'environnement et que le projet Supabase est bien
actif (non mis en pause).

## Structure

```
src/
  app/            routes (App Router)
    api/health/   contrôle de connexion Supabase
  lib/
    supabase/
      client.ts   client Supabase côté navigateur
      server.ts   client Supabase côté serveur (Server Components, Route Handlers)
```
