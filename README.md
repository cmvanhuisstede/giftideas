# Kado ideeën

This is a static Vercel site backed by Supabase. Visitors can view and claim/unclaim gifts without an account. Only the account registered in `owner_settings` can create gifts or upload cover images.

## Set up Supabase

1. Create a Supabase project.
2. In **SQL Editor**, run [`supabase/migrations/001_gifts.sql`](supabase/migrations/001_gifts.sql).
3. In **Authentication → Providers**, enable Email. Create your own user in **Authentication → Users**.
4. Copy that user's UUID and run the final `insert into public.owner_settings ...` statement from the migration file.
5. In **Project Settings → API**, copy the project URL and anon key into `config.js`. Do not put a service-role key in this file.

## Deploy to Vercel

1. Create a Git repository with these files and import it in Vercel, or deploy the folder with the Vercel CLI.
2. Deploy with the project root as the site root. `index.html` is the entrypoint.
3. After changing `config.js`, redeploy.

The Supabase anon key is intended for browser use. The database and storage policies in the migration enforce what every visitor is allowed to do.
