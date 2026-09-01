# Fleet Backend — Peppermint Robotics Challenge

This is the backend for the SDE-1 hiring challenge. It simulates a fleet of 8 autonomous robots, streams their telemetry over WebSocket, and exposes a REST API so the dashboard can query history, change config at runtime, and trigger disruptions.

## 🚀 Live Production URLs

- **Backend Production API:** https://peppermint-backend-x8h1.onrender.com
- **WebSocket Endpoint:** `wss://peppermint-backend-x8h1.onrender.com/ws`
- **Frontend Live Dashboard:** https://peppermint-frontend.vercel.app

---

## What it does

- **Simulates** 8 robots (cleaners, scrubbers, tugs, inspectors) moving around a 900×560 site in real time
- **Streams** live telemetry every 1 second over WebSocket (`/ws`)
- **Stores** per-robot position + status history in a ring buffer (last 300 events per robot)
- **Exposes REST endpoints** for fleet snapshot, robot history, runtime config changes, and disruption triggers
- **Fleet size is configurable** from 1 to 1000+ robots without restart
- **Tick rate is configurable** from 50ms to 30s without restart

---

## Tech

Node.js · TypeScript · Express · `ws` (WebSocket) · ts-node-dev for local dev · Jest for tests

---

## Getting started

```bash
npm install
npm run dev
```

Server starts at `http://localhost:4000`. No database, no Docker, no setup beyond Node 18.

If you want to change the default config, create a `.env` file:

```env
PORT=4000
FLEET_SIZE=8
TICK_INTERVAL_MS=1000
PAYLOAD_SIZE_BYTES=0
```

### Run tests

```bash
npm test
```

8 tests across two files — simulator kinematics and ingestion pipeline. All pass.

---

## API reference

### `GET /health`
Returns server status and current fleet metrics.
```json
{
  "status": "ok",
  "uptime": 42,
  "fleet": { "total": 8, "active": 5, "blocked": 1, "error": 0 },
  "config": { "fleetSize": 8, "tickIntervalMs": 1000 }
}
```

### `GET /api/robots`
Returns current snapshot of all robots (latest position, status, battery).
```json
[
  { "robot_id": "r1", "robot_type": "cleaner", "x": 230.4, "y": 180.1, "status": "active", "battery": 72.3 }
]
```

### `GET /api/robots/history/:id?limit=60`
Returns the last N telemetry events for a specific robot.
```json
{ "robot_id": "r1", "history": [ { "t": 10, "x": 230.4, "y": 180.1, "status": "active", "battery": 72.3 } ] }
```

### `POST /api/config`
Change fleet size, tick interval, or payload size at runtime. No restart needed.
```bash
curl -X POST http://localhost:4000/api/config \
  -H 'Content-Type: application/json' \
  -d '{"fleetSize": 50, "tickIntervalMs": 500}'
```

### `POST /api/disrupt`
Force a specific robot into a disrupted state immediately.
```bash
curl -X POST http://localhost:4000/api/disrupt \
  -H 'Content-Type: application/json' \
  -d '{"robot_id": "r3", "status": "error"}'
```

### `WebSocket /ws`
Connect once, get a continuous stream of telemetry batches.

**On connect** — you get an `INIT` message with the full fleet snapshot:
```json
{ "type": "INIT", "fleet": [...], "config": { ... } }
```

**Every tick** — you get a `TELEMETRY_BATCH`:
```json
{ "type": "TELEMETRY_BATCH", "events": [...] }
```

**On config change** — you get a `CONFIG_CHANGE`:
```json
{ "type": "CONFIG_CHANGE", "config": { ... } }
```

---

## Project structure

```
src/
  server.ts              — Express app + WebSocket server wiring
  types/index.ts         — All shared TypeScript types
  simulator/
    Robot.ts             — Single robot: kinematics, state machine, battery
    FleetSimulator.ts    — Manages the full fleet, tick loop, config updates
  history/
    HistoryStore.ts      — In-memory ring buffer for telemetry history
  ingestion/
    IngestionPipeline.ts — Receives events, updates snapshot, fans out to WS clients
  __tests__/
    simulator.test.ts    — Fleet scaling, bounds checking, disruption triggers
    ingestion.test.ts    — Ring buffer limits, pipeline snapshot accuracy
```

---

## Deploying to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo
4. Build command: `npm install && npm run build`
5. Start command: `node dist/server.js`
6. Add environment variables as needed (PORT is set by Render automatically)

The WebSocket endpoint will be `wss://your-service.onrender.com/ws`.

> Render's free tier sleeps after 15 minutes of inactivity. First request takes ~25s to wake up. Everything is normal after that.
