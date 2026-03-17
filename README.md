# OpenClaw Office

> A real-time visual dashboard for [OpenClaw](https://github.com/openclaw/openclaw) agents — see what your agents are actually doing.

OpenClaw Office renders live agent activity as an isometric virtual office. Agents sit at desks, sub-agents appear at hot desks, state changes animate in real time. It connects to your OpenClaw Gateway via WebSocket and derives everything from observable facts — no simulation, no guesswork.

Built on a **truth-first architecture**: every visible state maps to either a verifiable gateway fact or an explicit, documented inference rule. When the system is uncertain, it shows uncertainty instead of pretending confidence.

![office-2D](./assets/office-2d.png)

---

## What It Does

### 2D Office

- **SVG floor plan** with desk zones, hot desks, meeting areas, and a lounge
- **Live agent avatars** with status animations — idle, working, thinking, tool calling, speaking, error, sleeping, stale, disconnected
- **Sub-agent lifecycle** — sub-agents spawn at the lounge, move to hot desks, and disappear when done
- **Tool call bubbles** — human-readable descriptions of what agents are doing right now
- **Confidence indicators** — visual opacity and badges reflect how certain the derived state is
- **Collaboration lines** showing delegation between agents

### 3D Office

- **React Three Fiber scene** with character models and skill holograms
- Same truth-first state driving a different visual layer

### Sidebar Panels

- **Agent Detail** — status, evidence, derivation reason, confidence, current tool, speech, active clones
- **Sub-Agent Panel** — live sub-agent list with kill controls
- **Cron Panel** — view schedules, enable/disable, run now
- **Event Timeline** — filterable by time range (5m/15m/1h/6h/all) and event type (lifecycle/tool/assistant/error)
- **Metrics** — token usage, cost breakdown, activity heatmaps, network graphs
- **Quick Settings** — connection status, ambient sound toggle, console shortcuts

### Control Plane

Send tasks to agents, abort running sessions, manage crons, and kill sub-agents — all from the office sidebar without switching to the console.

### Console

Full management interface: Dashboard, Agents, Channels, Skills, Cron, Settings (providers, appearance, gateway, developer).

![console-dashboard](./assets/console-dashboard.png)

---

## Architecture

```
Gateway  ──WebSocket──>  ws-client  ──>  event-parser  ──>  evidence-store  ──>  state-deriver  ──>  office-store  ──>  React
                                                                                       │
                                                                              confidence + derivation
                                                                              reason flow to UI
```

**Evidence-based state derivation:**

1. Gateway WebSocket events and HTTP session refreshes produce per-agent evidence (lifecycle, tool calls, speech, errors, timestamps)
2. A deterministic derivation function computes canonical state from that evidence — WS lifecycle first, then WS activity, then HTTP corroboration, then staleness/time-of-day defaults
3. Confidence scores flow through to visuals — high-confidence states render solid, uncertain states show visual indicators
4. The rendering layer is a pure consumer of derived state, not a truth source

This replaced an earlier architecture where behavior smoothing and multiple competing state systems caused lag and contradictions.

---

## Quick Start

### Run without cloning

```bash
npx @ww-ai-lab/openclaw-office

# or install globally
npm install -g @ww-ai-lab/openclaw-office
openclaw-office
```

The Gateway auth token is auto-detected from `~/.openclaw/openclaw.json`. Override with `--token <token>` or `OPENCLAW_GATEWAY_TOKEN=<token>`.

### CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --token <token>` | Gateway auth token | auto-detected |
| `-g, --gateway <url>` | Gateway WebSocket URL | `ws://localhost:18789` |
| `-p, --port <port>` | Server port | `5180` |
| `--host <host>` | Bind address | `0.0.0.0` |

---

## Development

### Prerequisites

- **Node.js 22+**
- **pnpm**
- **[OpenClaw](https://github.com/openclaw/openclaw)** installed and running

### Setup

```bash
pnpm install

# Configure gateway token
cat > .env.local << 'EOF'
VITE_GATEWAY_TOKEN=<your-token>
EOF

# Get your token:
# openclaw config get gateway.auth.token

# Required: bypass device auth for web clients
openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
# Restart gateway after this change

pnpm dev
# → http://localhost:5180
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_GATEWAY_TOKEN` | Yes | — | Gateway auth token |
| `VITE_GATEWAY_URL` | No | `ws://localhost:18789` | Dev proxy upstream |
| `VITE_MOCK` | No | `false` | Mock mode (no gateway needed) |

### Commands

```bash
pnpm dev          # Dev server (port 5180)
pnpm build        # Production build
pnpm test         # Run tests
pnpm typecheck    # TypeScript check
pnpm lint         # Oxlint
pnpm format       # Oxfmt
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite 6 |
| UI | React 19 |
| 2D | SVG + CSS Animations |
| 3D | React Three Fiber + drei |
| State | Zustand 5 + Immer |
| Styling | Tailwind CSS 4 |
| Routing | React Router 7 |
| Charts | Recharts |
| i18n | i18next |
| Real-time | Native WebSocket |

---

## Project Structure

```
src/
├── gateway/          # WebSocket client, RPC, event parsing, adapters
├── store/            # Zustand stores — evidence, entities, spatial, events, orchestration
├── lib/              # State deriver, agent identities, tool display, ambient, zone config
├── hooks/            # Gateway connection, ambient, polling, sidebar layout
├── components/
│   ├── office-2d/    # SVG floor plan, avatars, desk units
│   ├── office-3d/    # R3F 3D scene
│   ├── panels/       # Agent detail, crons, sub-agents, metrics, timeline, settings
│   ├── layout/       # App shell, sidebar, top bar
│   ├── console/      # Console management pages
│   ├── chat/         # Chat dock
│   └── shared/       # Error boundaries, avatars, common components
└── styles/           # Global styles + ambient CSS
```

---

## Security Note

OpenClaw Office is designed for **local or private network use** (localhost, Tailscale, LAN). The `dangerouslyDisableDeviceAuth` bypass is required because web browsers cannot provide Ed25519 device signatures. Do not expose to the public internet without additional authentication.

---

## License

[MIT](./LICENSE)
