# Client

React and Vite storefront for Legacy Trophies.

## Structure

- `src/components` — reusable UI grouped by feature
- `src/pages` — route-level screens
- `src/routes` — router composition
- `src/layouts` — page shells
- `src/services` — backend API clients
- `src/data` — client-side fallback and customization data
- `src/content` — migrated page content and page scripts
- `src/styles` — global, layout, component, and page styles
- `src/hooks` and `src/utils` — shared client behavior
- `public/images` — static storefront assets

## Commands

Run from this folder or through the root workspace:

```bash
npm run dev
npm run build
npm run preview
```

Set `VITE_API_URL` only when the API is hosted on a different origin. Local development uses the Vite `/api` proxy.
