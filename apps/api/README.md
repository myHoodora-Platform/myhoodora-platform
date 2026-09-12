# MyHoodora API

The backend API for the MyHoodora platform, built with [NestJS](https://nestjs.com/).

## Purpose

This service provides the core business logic, data persistence, and communication layer for the MyHoodora community platform. It exposes a RESTful API consumed by the web application and other potential clients.

## Tech Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: MongoDB (via Mongoose)
- **Authentication**: Firebase Auth + JWT
- **Validation**: class-validator, class-transformer

## Setup & Local Development

### Prerequisites

Ensure you have followed the root setup instructions in the [main README](../../README.md).

### Running Locally

To run the API in development mode with hot-reload:

```bash
pnpm dev
```

Or, from the root, targeting only the API:

```bash
pnpm --filter @myhoodora/api dev
```

### Environment Variables

Create a `.env` file in this directory based on `.env.example`:

```bash
cp .env.example .env
```

| Variable              | Description               | Default |
| :-------------------- | :------------------------ | :------ |
| `PORT`                | Port for the API server   | `3333`  |
| `MONGODB_URI`         | MongoDB connection string | -       |
| `FIREBASE_PROJECT_ID` | Firebase Project ID       | -       |

## Available Scripts

| Command            | Description                                |
| :----------------- | :----------------------------------------- |
| `pnpm build`       | Transpile TypeScript to JavaScript (dist/) |
| `pnpm dev`         | Start the server in watch mode             |
| `pnpm start`       | Start the compiled production server       |
| `pnpm lint`        | Run ESLint checks                          |
| `pnpm check-types` | Run TypeScript type-checking               |

## Project Structure

- `src/`: Source code
  - `main.ts`: Application entry point
  - `app.module.ts`: Root module
  - `modules/`: Feature-specific modules (Auth, User, Community, etc.)
  - `common/`: Shared decorators, filters, guards, and interceptors
- `test/`: End-to-end tests

---

For broader project information, architecture, and contribution guidelines, please refer to the [Root README](../../README.md).
