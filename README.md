# Shirt & Pant Matcher — Cloud version

This is a mobile-friendly web app. Pants appear first, shirts second. Each section adds a blank row automatically when you type into its last row. Exact matching codes are highlighted and listed as pairs.

## What persists

- Entries are stored in Supabase, not only in the browser.
- Sign in with the same email on another phone to load the same list.
- Row data is private to the signed-in account through Row Level Security (RLS).
- The app saves after a short typing pause and shows save status.

## 1. Create the Supabase backend

1. Create a project at https://supabase.com/.
2. In the project, open **SQL Editor**, paste all of `supabase.sql`, and run it.
3. Open **Project Settings → API** (or **Data API / API Keys**, depending on dashboard version).
4. Copy the Project URL and the publishable key (or legacy `anon` key). Never use a `service_role` or secret key in the browser.

## 2. Configure the app

```bash
cp .env.example .env
```

Fill `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

## 3. Configure email sign-in

In Supabase, open **Authentication → URL Configuration**:
- Add your local development URL `http://localhost:5173`.
- Later, add your deployed website URL as a Redirect URL.
- Configure SMTP for reliable production email delivery. Supabase's default email service has testing limits.

## 4. Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. Enter your email and use the sign-in link sent to your inbox.

## 5. Deploy for a stable public URL

1. Extract this ZIP.
2. Upload the CONTENTS of the extracted `shirt-pant-cloud` folder to the root of a private GitHub repository. Do not upload the outer folder as a nested directory.
3. Confirm `package.json` and `index.html` appear at the top level of the GitHub repository.
4. Create a Cloudflare Pages project and connect that repository.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. In Cloudflare Pages → Settings → Builds → Build configuration, set build command to `npm run build` and output directory to `dist`.
6. In Cloudflare Pages → Settings → Builds → Environment variables (Production), add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Trigger a new deployment after saving the variables.
8. Copy the assigned `https://<project>.pages.dev` URL.
9. Add that URL to Supabase **Authentication → URL Configuration → Redirect URLs** and set it as the Site URL.

The `pages.dev` address remains stable across deployments for that project. A custom domain can be connected later.

## Security notes

- The browser key is intentionally the Supabase publishable/anon key. RLS is the actual data access boundary.
- Do not put a Supabase service-role key in `.env` or client code.
- Every user can access only their own `matcher_data` row.
- Cloud database backups and retention depend on your Supabase plan. Export important data periodically.

## Current behavior / known trade-off

One account owns one shared list. If the same account edits on two devices at exactly the same time, the most recent save can replace the earlier list. The app listens for remote changes when the current device has no unsaved edits. For a single-person inventory list this is usually sufficient; simultaneous multi-user editing would need conflict resolution.
