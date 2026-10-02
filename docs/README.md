# myHoodora documentation

This directory is the project's documentation of record. If a README or a comment disagrees with it, this is the one to trust (and the other one to fix).

| Read this | When you want to know |
| --- | --- |
| [current-state.md](./current-state.md) | What exists today, what is deferred, and what the MVP is |
| [architecture.md](./architecture.md) | How the web app, API and services fit together |
| [development.md](./development.md) | How to set up, run and change the code |
| [environment.md](./environment.md) | Every environment variable, where it goes and what it does |
| [authentication.md](./authentication.md) | Sign-in, sessions, the page gate, logout and revocation |
| [security.md](./security.md) | Headers, the content policy, secrets, and what is still a manual task |
| [testing.md](./testing.md) | The test suites, how to run them, and what they do and don't cover |
| [deployment.md](./deployment.md) | The release runbook: API first, then web, with checks and rollback |
| [roadmap.md](./roadmap.md) | What comes next, and what is explicitly post-MVP |
| [backlog-status.md](./backlog-status.md) | The outstanding-work list, item by item, with its real status |
| [api-contract.md](./api-contract.md) | Every API route and shape the web app relies on |
| [product/](./product/) | Product research that shaped the design (Nextdoor study) |
| [archive/](./archive/) | Old plans, audits and worklogs, kept for history. **Not current.** |

## Keeping it honest

- Describe what the code does, not what was planned. Plans go in `roadmap.md`.
- When behaviour changes, change the relevant page in the same pull request.
- Never put a credential, token, key or `.env` content in here. Variable *names* only.
- A document that stops being true moves to `archive/` with its date in the file name; it is not edited to look current.
