# myHoodora mobile (post-MVP)

This is an unmodified Expo starter, kept as the starting point for a future mobile app. **It is not part of the current product**: it has no screens, it is not in the pnpm workspace, and CI does not install, lint, test or build it. See [`docs/roadmap.md`](../../docs/roadmap.md).

To work on it, treat it as its own npm project:

```bash
cd apps/mobile
npm install
npx expo start
```

When mobile work begins, decide then whether to bring it into the workspace (remove the `!apps/mobile` line from `pnpm-workspace.yaml`, drop `package-lock.json`, and align its TypeScript version with the rest of the repository).
