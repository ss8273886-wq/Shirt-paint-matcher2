# Shirt & Pant Matcher — Shared public cloud version

## Behavior
- No login or signup.
- Every visitor sees and edits the same shared list.
- Pants appear first; shirts second.
- A blank row is added automatically while typing in the last row.
- Matching codes highlight in both lists.
- **Packed — remove matches** removes every matched code from BOTH lists after confirmation.
- **Clear all shared data** deletes the entire shared list after confirmation.
- Supabase Realtime broadcasts changes to other open devices.

## Important privacy warning
This version intentionally has no login. Anyone who knows the website URL can read, add, edit, pack/remove matches, and clear the shared list. Do not put private or sensitive information here. There is no per-person ownership or edit history.

## Supabase migration
1. Open Supabase Dashboard → SQL Editor → New Query.
2. Run the complete `supabase.sql` in this project.
3. This creates `shared_matcher_data` and public RLS policies for `anon` and `authenticated`.
4. The old `matcher_data` table is not deleted. Existing per-user rows are not automatically copied into the new shared list. If you need old data, copy it manually before switching.

## Cloudflare Pages
Build command: `npm run build`
Build output directory: `dist`
Root directory: `/`

Add Production build environment variables:
- `VITE_SUPABASE_URL` = `https://YOUR_PROJECT_ID.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = Supabase Publishable key (`sb_publishable_...`) or legacy anon key.

Do not use the Supabase secret or service-role key in browser code.

After updating variables or source code, trigger a new deployment.

## GitHub upload
Extract the ZIP and upload the contents directly to the repository root. `package.json` and `index.html` must be at the root, and `src/` must contain `main.js` and `style.css`.
