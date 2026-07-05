# MyHoodora Platform

MyHoodora is a hyper-local community platform for Nigeria, connecting neighbors and communities across cities.

## Project Overview

The MyHoodora platform is designed to facilitate local interaction, community management, and neighbor-to-neighbor services. It is built as a modern, high-performance monorepo to ensure scalability and developer efficiency.

## Tech Stack

- **Monorepo Management**: [Turborepo](https://turbo.build/repo)
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Frontend**: [Next.js](https://nextjs.org/) (React 19)
- **Backend**: [NestJS](https://nestjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
- **Authentication**: [Firebase Auth](https://firebase.google.com/docs/auth) + JWT
- **Code Quality**: [ESLint](https://eslint.org/), [Prettier](https://prettier.io/)

## Project Structure

```text
.
├── apps/
│   ├── api/          # NestJS Backend API
│   └── web/          # Next.js Frontend Web Application
├── packages/
│   ├── ui/           # Shared React Component Library
│   ├── eslint-config/# Shared ESLint configurations
│   └── typescript-config/ # Shared TypeScript configurations
├── package.json      # Root dependencies and scripts
├── pnpm-workspace.yaml
└── turbo.json        # Turborepo configuration
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 9.0.0

### Local Setup

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/arakunle22/myhoodora-platform.git
    cd myhoodora-platform
    ```

2.  **Install dependencies**:

    ```bash
    pnpm install
    ```

3.  **Environment Configuration**:
    Copy the environment example files in the respective applications:
    - `apps/api/.env.example` -> `apps/api/.env`
    - `apps/web/.env.example` -> `apps/web/.env`

4.  **Run the development server**:
    ```bash
    pnpm dev
    ```
    This will start both the API and Web applications in development mode.

## Development Workflow

### Common Commands

| Command            | Description                                |
| :----------------- | :----------------------------------------- |
| `pnpm dev`         | Start all applications in development mode |
| `pnpm build`       | Build all applications and packages        |
| `pnpm lint`        | Run linting checks across the monorepo     |
| `pnpm format`      | Format all files using Prettier            |
| `pnpm check-types` | Run type-checking across all packages      |

### Pre-PR Checklist

Before submitting a Pull Request, ensure the following pass:

- [ ] `pnpm lint` (No linting errors)
- [ ] `pnpm check-types` (No TypeScript errors)
- [ ] `pnpm build` (Project builds successfully)
- [ ] `pnpm format` (Code is correctly formatted)

## Git Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) to ensure a clean and readable project history. This is enforced using **commitlint** and **Husky** Git hooks.

### Commit Message Format

```text
type(optional scope): description
```

### Commit Types

| Type       | When to use                                                           |
| :--------- | :-------------------------------------------------------------------- |
| `feat`     | A new feature                                                         |
| `fix`      | A bug fix                                                             |
| `chore`    | Changes to the build process or auxiliary tools and libraries         |
| `docs`     | Documentation only changes                                            |
| `style`    | Changes that do not affect the meaning of the code (white-space, etc) |
| `refactor` | A code change that neither fixes a bug nor adds a feature             |
| `test`     | Adding missing tests or correcting existing tests                     |

### Examples

- `feat(auth): add login page`
- `fix(api): resolve user profile update bug`
- `docs(readme): update git convention section`
- `chore(deps): upgrade turbo version`

### Note on Tooling

These rules apply regardless of how you commit—whether via the **terminal**, **Sourcetree**, **VS Code**, or any other Git client. The hooks will automatically validate your message before the commit is finalized.

### Bypassing Hooks

If you absolutely need to bypass the hooks (e.g., for a work-in-progress commit that doesn't meet the standards yet), you can use the `--no-verify` flag:

```bash
git commit -m "wip: temporary commit" --no-verify
```

_Note: Bypassing hooks should be avoided whenever possible and is only acceptable for temporary local commits._

## CI/CD

We use GitHub Actions for continuous integration. Every push and pull request to `main` and `develop` branches triggers the CI pipeline, which runs:

- Dependency installation
- Linting
- Type checking
- Build verification

## Contribution Guidelines

1.  Create a feature branch from `develop`.
2.  Follow the [Pre-PR Checklist](#pre-pr-checklist).
3.  Submit a Pull Request with a clear description of changes.
4.  Ensure all CI checks pass before requesting a review.
