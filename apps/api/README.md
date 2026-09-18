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

## TODO / Backend Follow-ups

Frontend work has surfaced real gaps the backend doesn't cover yet. Tracked here rather than faked in the UI:

- **Admin management endpoints.** The admin panel (`apps/web/src/app/admin`) currently runs on `apps/web/src/lib/admin/mock-data.ts` for everything except neighborhoods. Needed to go real:
  - Users list/verify/restrict (admin-scoped `GET /users`, a way to set `verificationStatus`/`role`, a restrict/ban flag).
  - Support queries inbox (a `Queries`/tickets module: create by users, list/respond/resolve by admins).
  - Notifications send + history (a `Notifications` module: send-to-audience, list sent history).
- **Comments module.** No schema or endpoints exist for commenting on a post. Needed before any comment UI can be built for real (not a local mock — a comment only makes sense if every neighbor can see it): a `Comment` schema (`postId`, `authorUid`, `content`, timestamps) + `POST/GET/DELETE` endpoints, mirroring the Posts module's own shape.
- **Typed reactions.** `Post.likes` is a plain `string[]` of uids — a toggle, not a reaction type. The frontend's Facebook-style reaction picker can only persist "did this uid react," not *which* emoji (👍/❤️/😂/😮/😢/😡) they picked for anyone but themselves (remembered client-side only, per device). To show everyone's actual reaction type, `likes: string[]` needs to become something like `reactions: { uid: string; type: "like" | "love" | "haha" | "wow" | "sad" | "angry" }[]`, and `PATCH /posts/:id/like` needs to accept a `type` in its body.
- **Public user lookup by uid.** No endpoint resolves another user's uid to a display name/avatar (`GET /users/me` only returns the caller's own profile). The feed shows a generic "Neighbor" label for every post author but the viewer themself, and admin's user search is mock data, because of this gap. A `GET /users/:uid` (public-safe fields only: displayName, photo) or a batch `POST /users/batch` would unblock both.
- **Firebase Storage security rules** need to allow an authenticated user to write under `posts/{uid}/...` for the feed's real image-upload path (`apps/web/src/lib/feed/media-provider.ts`) to work — this is a Firebase Console/CLI config step, not application code. Suggested rule:
  ```
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /posts/{uid}/{fileName} {
        allow read: if true;
        allow write: if request.auth != null && request.auth.uid == uid
          && request.resource.size < 8 * 1024 * 1024
          && request.resource.contentType.matches('image/.*');
      }
    }
  }
  ```

---

For broader project information, architecture, and contribution guidelines, please refer to the [Root README](../../README.md).
