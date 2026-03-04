# Replayly CLI

Replay production requests locally for debugging.

## Installation

```bash
npm install -g @replayly/cli
```

Or link from the monorepo:

```bash
cd packages/cli && npm run build && npm link
```

## Configuration

- **REPLAYLY_API_URL** (or **API_URL**): API base URL. Default: `https://api.replayly.dev`. For local development set to `http://localhost:3000`.

## Quick Start

```bash
# Authenticate (opens browser / device flow)
replayly login

# List projects
replayly projects

# List recent events
replayly events

# Replay an event by ID
replayly replay --event-id <requestId>

# Replay with custom port
replayly replay --event-id <requestId> --port 4000
```

## Commands

### `replayly login`

Authenticate with Replayly using device flow. You will be shown a URL and code; open the URL, enter the code, and authorize the CLI.

### `replayly logout`

Clear stored credentials.

### `replayly projects`

List your Replayly projects.

### `replayly events`

List captured events.

Options:

- `-p, --project <id>` — Project ID
- `-l, --limit <number>` — Number of events (default: 20)
- `--errors-only` — Show only errors
- `--route <route>` — Filter by route

### `replayly replay`

Replay a captured event against your local server.

Options:

- `-e, --event-id <id>` — Event ID to replay (if omitted, you will be prompted to select one)
- `-p, --port <port>` — Local server port (default: 3000)
- `--host <host>` — Local server host (default: localhost)
- `--https` — Use HTTPS
- `--dry-run` — Print request payload without executing

## Local development

1. Start the Replayly app (e.g. `npm run dev`).
2. Set `REPLAYLY_API_URL=http://localhost:3000` when running the CLI.
3. Run `replayly login` and complete the device flow at http://localhost:3000/device.
4. Run `replayly events` then `replayly replay` to replay an event.
