# Silver Crown Metals - Element

## Project Overview
A full-stack web application for **Silver Crown Metals**, featuring the **Element** system login screen. The UI was imported from a Figma design.

## Tech Stack
- **Frontend**: React 18 + TypeScript, Tailwind CSS, Radix UI (shadcn), Framer Motion, TanStack Query, wouter
- **Backend**: Express.js (v5), Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod (shared between frontend and backend)
- **Auth**: Passport.js (local strategy) + express-session
- **Build**: Vite (frontend), tsx (dev), ESBuild (prod)

## Structure
- `client/` — React frontend
  - `src/pages/ElementLogInScreen.tsx` — Main login page
  - `src/App.tsx` — Router setup
- `server/` — Express backend
  - `index.ts` — Server entry point
  - `routes.ts` — API routes
  - `storage.ts` — Storage abstraction layer
- `shared/schema.ts` — Drizzle schema + Zod types shared between client and server

## Running
- Development: `npm run dev` (starts Express + Vite on port 5000)
- Production build: `npm run build` → `node ./dist/index.cjs`

## Notes
- The login screen scales to fit any viewport using CSS transform scaling from a 1920×1080 base design
- Figma assets are served from `/figmaAssets/`
