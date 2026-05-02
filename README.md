# DTS-MPDO-Alubijid

**Document Tracking System** for the Municipal Planning and Development Office (MPDO) of Alubijid.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Local Development Setup](#local-development-setup)
4. [Staging Environment](#staging-environment)
5. [CI/CD Pipeline Overview](#cicd-pipeline-overview)
6. [GitHub Releases](#github-releases)
7. [Git Workflow SOP](#git-workflow-sop)

---

## Project Overview

DTS-MPDO-Alubijid is a web-based Document Tracking System built for the Municipal Planning and Development Office. It allows staff to submit, track, and manage official documents through a structured digital workflow, replacing manual paper-based processes.

Key features:
- Document submission and status tracking
- Google Drive integration for file storage
- Google OAuth authentication
- Role-based access for MPDO staff
- Supabase (PostgreSQL) backend for data persistence

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 7 |
| Styling | TailwindCSS 3, Radix UI |
| State / Data | React Query, React Router 6 |
| Backend | Express.js (Node.js) |
| Database | Supabase (PostgreSQL) |
| Auth | Google OAuth 2.0, Supabase Auth |
| Storage | Google Drive API |
| Package Manager | pnpm 10.14.0 |
| Containerization | Docker, Docker Compose |
| Serverless | Netlify Functions |

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- pnpm 10.14.0+
- A Supabase project
- Google Cloud project with OAuth 2.0 credentials and Drive API enabled

### Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/<org>/DTS-MPDO-Alubijid.git
   cd DTS-MPDO-Alubijid
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example env file and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

   Required variables:

   | Variable | Description |
   |---|---|
   | `VITE_SUPABASE_URL` | Your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anonymous public key |
   | `DATABASE_URL` | Full Supabase PostgreSQL connection string |
   | `GOOGLE_CLIENT_ID` | Google OAuth client ID |
   | `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
   | `GOOGLE_REFRESH_TOKEN` | Google API refresh token |
   | `GOOGLE_DRIVE_FOLDER_ID` | Target Google Drive folder for uploads |
   | `VITE_API_URL` | Backend API base URL (default: `http://localhost:5000`) |

4. **Start the development servers**

   ```bash
   pnpm dev
   ```

   This starts:
   - Frontend (Vite) at `http://localhost:5173`
   - Backend (Express) at `http://localhost:5000`

5. **Run tests**

   ```bash
   cd backend
   node server.js
   npm run dev
   ```

6. **Build for production**

   ```bash
   pnpm build
   ```

   Output is placed in `dist/`.

### Docker (optional)

To run the full stack in containers:

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

---

## Staging Environment

The staging environment is used for pre-production testing before merging to `main` or cutting a release.

| | |
|---|---|
| **URL** | *(to be configured — update once deployed)* |
| **Branch** | `staging` |
| **Auth** | Google OAuth (use your MPDO Google account) |
| **Database** | Staging Supabase project (separate from production) |

> **Note:** The staging environment is reset periodically. Do not store critical data there.

### Accessing the Staging Build

1. Navigate to the staging URL above.
2. Sign in using your MPDO Google account via the "Sign in with Google" button.
3. You will be redirected to the dashboard upon successful authentication.

For backend API staging access, the `VITE_API_URL` on the staging deployment points to the staging Express server.

---

## CI/CD Pipeline Overview

The project uses a Docker-based build pipeline. Deployment is triggered manually or via branch push depending on the hosting provider (Netlify / self-hosted Docker host).

```
Developer pushes to `staging` branch
        │
        ▼
  pnpm install + pnpm build
        │
        ▼
  Docker image built (frontend: Nginx, backend: Node Alpine)
        │
        ▼
  Image deployed to staging host
        │
        ▼
  Staging URL updated and smoke-tested
        │
        ▼ (after QA sign-off)
  PR merged to `main` → production deployment
```

Key pipeline steps:
- Dependency installation via `pnpm`
- TypeScript type-checking
- Vite production build
- Docker image build and push
- Container deployment via Docker Compose

---

## GitHub Releases

Tagged releases follow [Semantic Versioning](https://semver.org/) (`vMAJOR.MINOR.PATCH`).

View all releases: [GitHub Releases](../../releases)

Each release includes:
- A changelog summary of merged PRs
- A downloadable production build artifact
- The Docker image tag used for that release

To create a new release, tag the commit on `main`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Git Workflow SOP

The team follows a feature-branch workflow:

| Branch | Purpose |
|---|---|
| `main` | Production-ready code only |
| `staging` | Pre-production integration and QA |
| `feature/*` | New features, branched from `staging` |
| `fix/*` | Bug fixes, branched from `staging` |
| `hotfix/*` | Critical production fixes, branched from `main` |

### Standard Flow

```
feature/my-feature  →  staging  →  main
```

1. Branch off `staging`: `git checkout -b feature/your-feature staging`
2. Commit your changes with clear, descriptive messages.
3. Open a Pull Request targeting `staging`.
4. Request a code review from at least one team member.
5. After approval and passing checks, merge to `staging`.
6. After QA sign-off on staging, open a PR from `staging` → `main`.

Full Git Workflow SOP: *(link to internal SOP document or wiki page)*

---

*For questions, contact the MPDO development team.*
