# OpenClaw Office

> A real-time office-style control surface for OpenClaw agents.

OpenClaw Office is the visual monitoring and management frontend for
[OpenClaw](https://github.com/openclaw/openclaw). It connects to the OpenClaw
Gateway over WebSocket, derives agent state from observable evidence, and
renders that state as a live digital office plus a full management console.

The current app has three major surfaces:

- Office view: Pixi-powered 2D office plus an alternate React Three Fiber 3D scene
- Chat dock: bottom-docked agent chat with streaming history and abort controls
- Console: dashboard, agents, channels, skills, cron, and settings

![office-2D](./assets/office-2d.png)

## What The App Does

### Office View

- Pixi.js 2D office renderer with desks, hot desks, meeting areas, lounge zones, and animated agents
- React Three Fiber 3D scene driven by the same derived agent state
- Agent avatars, tool activity, speech bubbles, collaboration links, and timeline panels
- Mobile-aware behavior that forces the lighter 2D mode on smaller screens

### Control And Operations

- Send chat messages to agent sessions and abort running work
- Inspect agent details, files, tools, skills, channels, and cron bindings
- Track usage, event history, collaboration, and sub-agent activity
- Manage local installed skills and browse external skill metadata from ClawHub

### Connection Modes

- Local Gateway mode via same-origin `/gateway-ws`
- Remote Gateway mode via the same proxy path, with the browser still talking to the Office server
- Token loading from `VITE_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_TOKEN`, or detected OpenClaw config files depending on how the app is started

![console-dashboard](./assets/console-dashboard.png)

## Architecture

The app is built around an evidence-first state pipeline:

```text
Gateway events/RPC
  -> ws-client / rpc-client
  -> adapter-provider / ws-adapter
  -> event-parser
  -> evidence-store
  -> state-deriver
  -> Zustand slices
  -> Pixi office / React panels / R3F scene
```

What matters in practice:

1. WebSocket frames are the primary real-time source.
2. Parsed events update per-agent evidence rather than directly mutating UI truth.
3. A deterministic derivation step computes visible status, confidence, tool text, and speech.
4. Rendering layers consume derived state. They are not the source of truth.

This repo also contains older SVG-based office components under `src/components/office-2d/`.
They still exist, but the main 2D office route currently uses the Pixi renderer.

## Quick Start

### Run The Packaged App

```bash
npx @ww-ai-lab/openclaw-office

# or install globally
npm install -g @ww-ai-lab/openclaw-office
openclaw-office
```

CLI options:

| Flag | Description | Default |
| --- | --- | --- |
| `-t, --token <token>` | Gateway auth token | auto-detected when possible |
| `-g, --gateway <url>` | Gateway WebSocket URL | `ws://localhost:18789` |
| `-p, --port <port>` | Office server port | `5180` |
| `--host <host>` | Bind address | `0.0.0.0` |
| `-h, --help` | Show help | — |

Gateway URL resolution order:

1. `--gateway`
2. `OPENCLAW_GATEWAY_URL`
3. `~/.openclaw/openclaw-office.json`
4. `ws://localhost:18789`

Token resolution order:

1. `--token`
2. `OPENCLAW_GATEWAY_TOKEN`
3. `~/.openclaw/openclaw.json`
4. `~/.clawdbot/clawdbot.json`

If the Gateway URL includes `?token=...`, Office extracts that token and strips it from the upstream URL before connecting.

## Development

### Prerequisites

- Node.js 22+
- `pnpm` for the standard workflow
- A running OpenClaw Gateway for real integration, or `VITE_MOCK=true` for UI-only work

### Install

```bash
pnpm install
```

### Configure A Real Gateway

Get the token:

```bash
openclaw config get gateway.auth.token
```

Then create `.env.local`:

```bash
cat > .env.local << 'EOF'
VITE_GATEWAY_TOKEN=<your-token>
EOF
```

If you need a non-default upstream in dev, add:

```bash
VITE_GATEWAY_URL=ws://your-gateway-host:18789
```

OpenClaw Gateway 2026.2.15+ requires device identity for many clients. The web UI needs the documented bypass:

```bash
openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
```

Restart the Gateway after that change.

### Start The App

```bash
pnpm dev
```

The browser connects to `/gateway-ws`. In dev, Vite proxies that path to the configured upstream Gateway. In the packaged server, the bundled Node server performs that same proxy role.

### Mock Mode

```bash
VITE_MOCK=true pnpm dev
```

This enables the mock adapter and simulated agent activity without a live Gateway.

### Commands

```bash
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

- `pnpm` is the canonical package manager for this repo, but `npm run <script>` also works when dependencies are already installed.
- `lint` and `format` call `oxlint` and `oxfmt` binaries directly. If those commands are not on your `PATH`, those scripts will fail even if the repo has been installed.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Build | Vite 6 |
| UI | React 19 |
| 2D | Pixi.js and legacy SVG components |
| 3D | React Three Fiber, drei, postprocessing |
| State | Zustand 5 + Immer |
| Styling | Tailwind CSS 4 |
| Routing | React Router 7 |
| Charts | Recharts |
| i18n | i18next + react-i18next |
| Realtime | Native WebSocket API |

## Project Structure

```text
src/
├── App.tsx, main.tsx            # bootstrapping, routing, connection setup
├── gateway/                     # ws/rpc clients, adapters, event parsing, ClawHub client
├── store/                       # Zustand slices, evidence store, event orchestration
├── pixi/                        # main 2D office renderer and engine
├── components/
│   ├── office-2d/               # legacy SVG office pieces
│   ├── office-3d/               # R3F scene
│   ├── panels/                  # office-side panels
│   ├── chat/                    # chat dock
│   ├── console/                 # console feature components
│   ├── layout/                  # shells, sidebar, top bar
│   └── shared/                  # shared UI
├── hooks/                       # gateway, polling, responsive, ambient hooks
├── lib/                         # derivation, URLs, persistence, view helpers
└── i18n/                        # zh/en resources
```

## Security Note

OpenClaw Office is designed for local or private-network use. The browser-facing
token endpoint and the `dangerouslyDisableDeviceAuth` Gateway setting both assume
you control the environment around the UI. Do not expose this directly to the
public internet without an additional authentication layer.

## License

[MIT](./LICENSE)
