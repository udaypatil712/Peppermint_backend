import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { FleetSimulator } from './simulator/FleetSimulator';
import { HistoryStore } from './history/HistoryStore';
import { IngestionPipeline } from './ingestion/IngestionPipeline';
import { TelemetryEvent } from './types';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4000', 10);
const API_KEY = process.env.API_KEY || 'peppermint-secret';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Core Services
const historyStore = new HistoryStore(500);
const pipeline = new IngestionPipeline(historyStore);
const simulator = new FleetSimulator({
  fleetSize: parseInt(process.env.FLEET_SIZE || '8', 10),
  tickIntervalMs: parseInt(process.env.TICK_INTERVAL_MS || '1000', 10),
  payloadSizeBytes: parseInt(process.env.PAYLOAD_SIZE_BYTES || '0', 10),
  simulateDisruptions: true,
});

// Connect Simulator -> Ingestion Pipeline
simulator.setOnTelemetry((events: TelemetryEvent[]) => {
  pipeline.ingest(events);
});

// HTTP Server & WebSocket Server setup
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Track active WebSocket connections
interface CustomWebSocket extends WebSocket {
  isAlive?: boolean;
}

wss.on('connection', (ws: CustomWebSocket) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Send initial snapshot & config
  const initMsg = JSON.stringify({
    type: 'INIT',
    fleet: pipeline.getCurrentSnapshot(),
    config: simulator.getConfig(),
    serverTime: Date.now(),
  });
  ws.send(initMsg);

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
  });
});

// Heartbeat ping interval to clean up stale/dropped sockets
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws: CustomWebSocket) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 15000);

wss.on('close', () => {
  clearInterval(pingInterval);
});

// Broadcast Telemetry Batches to all connected WS clients
pipeline.subscribe((events: TelemetryEvent[]) => {
  if (wss.clients.size === 0) return;

  const payload = JSON.stringify({
    type: 'TELEMETRY_BATCH',
    events,
    timestamp: Date.now(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
});

// --- REST API Endpoints ---

// Health & Metrics
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    metrics: pipeline.getMetrics(wss.clients.size),
    config: simulator.getConfig(),
  });
});

// Get current fleet snapshot
app.get('/api/robots', (req: Request, res: Response) => {
  res.json({
    count: pipeline.getCurrentSnapshot().length,
    robots: pipeline.getCurrentSnapshot(),
  });
});

// Stretch Goal: History API endpoint
app.get('/api/robots/history/:robot_id', (req: Request, res: Response) => {
  const { robot_id } = req.params;
  const startTime = req.query.start ? parseInt(req.query.start as string, 10) : undefined;
  const endTime = req.query.end ? parseInt(req.query.end as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

  const history = historyStore.getHistory(robot_id, startTime, endTime, limit);
  res.json({
    robot_id,
    count: history.length,
    history,
  });
});

// Get current configuration
app.get('/api/config', (req: Request, res: Response) => {
  res.json(simulator.getConfig());
});

// Update simulator configuration (Live control knobs without redeploy)
app.post('/api/config', (req: Request, res: Response) => {
  const { fleetSize, tickIntervalMs, payloadSizeBytes, simulateDisruptions } = req.body;

  const updated = simulator.updateConfig({
    fleetSize,
    tickIntervalMs,
    payloadSizeBytes,
    simulateDisruptions,
  });

  // Notify WebSocket clients of config change
  const configMsg = JSON.stringify({
    type: 'CONFIG_CHANGE',
    config: updated,
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(configMsg);
    }
  });

  res.json({ message: 'Configuration updated successfully', config: updated });
});

// Chaos Disruption API
app.post('/api/disrupt', (req: Request, res: Response) => {
  const { robot_id, status } = req.body;
  if (!robot_id || !status) {
    return res.status(400).json({ error: 'Missing robot_id or status' });
  }

  const success = simulator.triggerDisruption(robot_id, status);
  if (success) {
    res.json({ message: `Disruption applied: ${robot_id} -> ${status}` });
  } else {
    res.status(404).json({ error: `Robot ${robot_id} not found` });
  }
});

// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Peppermint Robotics Fleet Backend live on port ${PORT}`);
  console.log(` HTTP API: http://localhost:${PORT}`);
  console.log(` WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`====================================================`);
  simulator.start();
});
