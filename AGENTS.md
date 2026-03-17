# OpenClaw Office — Agent Development Guide

> [中文版](./AGENTS.zh.md)

This document gives AI coding assistants working context for the current
OpenClaw Office codebase.

## Project Overview

OpenClaw Office is the visual monitoring and management frontend for
[OpenClaw](https://github.com/openclaw/openclaw). It connects to the OpenClaw
Gateway over WebSocket, derives agent state from observable evidence, and
renders that state as:

- a live office view at `/`
- a bottom chat dock for agent conversations
- a console surface at `/dashboard`, `/agents`, `/channels`, `/skills`, `/cron`, `/settings`

## Current Stack

| Area | Technology |
| --- | --- |
| Language | TypeScript, ESM, strict mode |
| UI | React 19 |
| Build | Vite 6 |
| Routing | React Router 7 with `HashRouter` |
| State | Zustand 5 + Immer |
| Styling | Tailwind CSS 4 |
| 2D rendering | Pixi.js for the active office view, plus legacy SVG office components |
| 3D rendering | React Three Fiber + drei + postprocessing |
| Charts | Recharts |
| i18n | i18next + react-i18next |
| Testing | Vitest + Testing Library |
| Realtime | Native WebSocket API |

## What Exists In The Repo

### Office View

- `src/pixi/` contains the active 2D office engine and renderer
- `src/components/office-3d/` contains the alternate 3D scene
- `src/components/office-2d/` still contains older SVG office components and avatars
- `src/components/panels/` contains office-side panels like metrics, timeline, sub-agents, and agent detail

### Console

- Dashboard, agents, channels, skills, cron, and settings all have dedicated page/store/component groupings
- Skills UI includes local installed skill management plus read-only ClawHub browsing/search
- Settings includes provider management, model editing, gateway controls, appearance, developer, advanced, about, and update sections

### Gateway Integration

- `src/gateway/ws-client.ts` implements socket lifecycle, challenge/connect auth, reconnect, and shutdown handling
- `src/gateway/rpc-client.ts` wraps RPC requests over the same socket
- `src/gateway/ws-adapter.ts` exposes Gateway features behind an adapter interface
- `src/gateway/adapter-provider.ts` swaps between real and mock adapters
- `src/gateway/clawhub-client.ts` is a separate REST client for ClawHub metadata

### State Pipeline

The important architecture is:

```text
Gateway frames / RPC
  -> event-parser
  -> evidence-store
  -> state-deriver
  -> event-orchestrator
  -> Zustand slices
  -> Pixi / React / R3F
```

Relevant files:

- `src/gateway/event-parser.ts`
- `src/store/evidence-store.ts`
- `src/lib/state-deriver.ts`
- `src/store/event-orchestrator.ts`
- `src/store/index.ts`

When debugging visible agent behavior, read those files before changing rendering code.

## Directory Guide

```text
src/
├── App.tsx, main.tsx            # app bootstrap, routes, connection setup
├── gateway/                     # ws/rpc clients, adapters, protocol types, ClawHub client
├── store/                       # store slices, evidence, telemetry, orchestration
├── pixi/                        # active 2D office engine
├── components/
│   ├── office-2d/               # legacy SVG office UI
│   ├── office-3d/               # R3F scene
│   ├── panels/                  # office-side panels
│   ├── chat/                    # chat dock
│   ├── console/                 # console feature components
│   ├── pages/                   # route pages
│   ├── layout/                  # shells and nav
│   └── shared/                  # shared UI
├── hooks/                       # gateway, polling, ambient, responsive hooks
├── lib/                         # derivation helpers, persistence, view helpers
└── i18n/                        # zh/en translations
```

## Development Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm test:watch
pnpm typecheck
pnpm lint
pnpm format
pnpm check
```

Notes:

- `pnpm` is the standard workflow.
- `npm run <script>` is acceptable when dependencies are already installed and `pnpm` is unavailable.
- `lint` and `format` rely on `oxlint` and `oxfmt` binaries being available on `PATH`.

## Gateway Behavior

### Connection Model

- The browser connects to the same-origin `/gateway-ws` endpoint
- In dev, Vite proxies that to the configured upstream Gateway
- In the packaged app, the bundled Node server proxies that path
- The UI can run in local or remote Gateway mode without changing browser-side code

### Auth Flow

1. WebSocket opens
2. Gateway sends `connect.challenge`
3. UI sends `connect` with `client.id = openclaw-control-ui`, scopes, and token when available
4. Gateway returns `hello-ok`

### Common Events And RPC

Primary real-time events:

- `agent`
- `chat`
- `presence`
- `health`
- `heartbeat`
- `cron`
- `shutdown`

Common RPC methods used by the app include:

- `agents.list`
- `sessions.list`
- `sessions.preview`
- `sessions.delete`
- `usage.status`
- `tools.catalog`
- `chat.send`
- `chat.abort`
- `chat.history`
- `cron.list`
- `config.get`

## Store And State Guidance

- Treat evidence and derivation as canonical. Do not encode new truth rules only in presentation components.
- `useGatewayConnection` bootstraps agents from several fallback sources. Preserve that behavior unless you can prove a source is obsolete.
- `event-orchestrator` owns run/session mapping, sub-agent emergence, and event history updates.
- `office-ui-store`, `agent-entity-store`, `spatial-store`, `collaboration-store`, and `telemetry-store` are composed into one Zustand store.

## i18n Rules

All user-visible text should go through i18n.

- React components: `useTranslation(namespace)`
- Non-React files: `import i18n from "@/i18n"; i18n.t("ns:key")`
- English and Chinese locale JSON files must keep matching key structures
- Do not localize technical identifiers, import paths, or CSS class names

Namespaces currently used:

- `common`
- `layout`
- `office`
- `panels`
- `chat`
- `console`

## Quality Bar

These are the practical rules to follow in this repo:

- Keep TypeScript strict. Avoid introducing new `any`; reduce existing `any` usage when you touch nearby code.
- Prefer keeping new files below roughly 500 lines, but optimize for coherent boundaries rather than arbitrary churn.
- Add comments only for non-obvious logic.
- Preserve the evidence-first state model.
- Prefer extending existing slices and helpers instead of duplicating state logic in components.
- Keep user-visible strings in i18n.

Current repo reality:

- There are existing oversized files and a few `any` escape hatches.
- Do not expand that drift without a reason.
- If you touch one of those areas, prefer incremental cleanup rather than broad refactors unless explicitly asked.

## Testing Expectations

- When changing derivation, event parsing, or store orchestration, add or update unit tests in `tests/`
- When changing key UI flows, add or update Testing Library coverage where practical
- Check `npm test` or `pnpm test` after meaningful behavior changes
- If lint/format commands are unavailable in the environment, say so explicitly

## OpenClaw Reference Files

The upstream OpenClaw repo is still the protocol authority. Useful reference files there:

- `src/infra/agent-events.ts`
- `src/gateway/protocol/schema/frames.ts`
- `src/gateway/server/ws-connection.ts`
- `src/gateway/server-methods-list.ts`
- `src/config/types.agents.ts`
