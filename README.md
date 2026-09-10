# ITL Curation Web

Web app for reviewing ITL Online chart submissions, replacing the Google Sheet the review panel used previously. Reviewers log in with Discord, rate submissions, flag basic-check failures, and disqualify charts; a separate ETL pipeline (in a sibling repo, not part of this codebase) parses submitted charts and populates the database this app serves.

See [REQUIREMENTS.md](./REQUIREMENTS.md) for the full design and data model context.

## Stack

- **API**: NestJS (`apps/api`), Prisma ORM, Discord OAuth2 login
- **Web**: React + Vite + Tailwind, shadcn/ui components (`apps/web`)
- **DB**: PostgreSQL

## Getting started

```bash
npm install
cp .env.example .env # fill in Discord OAuth credentials and JWT_SECRET
docker compose up -d # starts Postgres
npm run db:migrate
npm run dev # runs API and web concurrently
```

The API listens on `http://localhost:3000`, the web app on `http://localhost:5173`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API and web app together, with reload |
| `npm run build` | Build both apps |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Open Prisma Studio |
