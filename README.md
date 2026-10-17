This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploying

Runs on the VPS (expenses.chakkritton.com): a push to `main` rebuilds the app and the reminders
service (see deploy/apps in the Thai-Weather repo). Login is Supabase Auth; the data is in the
VPS's Postgres (`db/schema.sql`), reached through a gateway that checks the Supabase session, so
RLS works as it did on Supabase. Bill reminders: `reminders/` and `docs/push-notifications.md`.

## VPS runtime

The Next.js standalone server runs on Bun 1.4.2. Elysia 1.4.30 handles the read-only
`/api/health` dependency probe and `/api/healthz` container liveness probe. Supabase Auth,
server actions and data access keep their existing behavior. The separate Bun + Elysia
reminders service is unchanged. Container health checks use `/api/healthz`, which does
not render pages, query the database or send notifications.
