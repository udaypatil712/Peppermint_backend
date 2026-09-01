import { Robot } from './Robot';
import { FleetConfig, RobotRosterEntry, RobotType, TelemetryEvent } from '../types';
import fs from 'fs';
import path from 'path';

export class FleetSimulator {
  private robots: Map<string, Robot> = new Map();
  private config: FleetConfig;
  private timer: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();
  private onTelemetryCallback: ((events: TelemetryEvent[]) => void) | null = null;
  private initialRoster: RobotRosterEntry[] = [];

  constructor(config: Partial<FleetConfig> = {}) {
    this.config = {
      fleetSize: config.fleetSize ?? 8,
      tickIntervalMs: config.tickIntervalMs ?? 1000,
      payloadSizeBytes: config.payloadSizeBytes ?? 0,
      simulateDisruptions: config.simulateDisruptions ?? true,
    };

    this.loadInitialRoster();
    this.syncFleetSize();
  }

  private loadInitialRoster() {
    try {
      const rosterPath = path.resolve(__dirname, '../../../robots.json');
      if (fs.existsSync(rosterPath)) {
        const raw = fs.readFileSync(rosterPath, 'utf-8');
        this.initialRoster = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not load robots.json, fallback to auto-generated roster:', e);
    }
  }

  private syncFleetSize() {
    const currentSize = this.robots.size;
    const targetSize = this.config.fleetSize;

    if (targetSize > currentSize) {
      // Add robots
      for (let i = currentSize + 1; i <= targetSize; i++) {
        const id = `r${i}`;
        // Check if initial roster has this robot
        const initial = this.initialRoster.find((r) => r.robot_id === id);
        if (initial) {
          this.robots.set(
            id,
            new Robot(id, initial.robot_type, initial.x, initial.y, initial.battery, initial.status)
          );
        } else {
          const types: RobotType[] = ['cleaner', 'scrubber', 'tug', 'inspection'];
          const randType = types[Math.floor(Math.random() * types.length)];
          const rx = 15 + Math.random() * 870;
          const ry = 15 + Math.random() * 530;
          const rb = 30 + Math.random() * 70;
          this.robots.set(id, new Robot(id, randType, rx, ry, rb, 'idle'));
        }
      }
    } else if (targetSize < currentSize) {
      // Scale down robots
      const keys = Array.from(this.robots.keys());
      for (let i = targetSize; i < keys.length; i++) {
        this.robots.delete(keys[i]);
      }
    }
  }

  public setOnTelemetry(cb: (events: TelemetryEvent[]) => void) {
    this.onTelemetryCallback = cb;
  }

  public start() {
    if (this.timer) clearInterval(this.timer);
    this.startTime = Date.now();

    const tick = () => {
      const deltaSeconds = this.config.tickIntervalMs / 1000;
      const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);

      const events: TelemetryEvent[] = [];
      const dummyPayload = this.config.payloadSizeBytes > 0
        ? 'X'.repeat(this.config.payloadSizeBytes)
        : undefined;

      this.robots.forEach((robot) => {
        const ev = robot.update(deltaSeconds, this.config.simulateDisruptions);
        ev.t = elapsedSeconds;
        ev.timestamp = Date.now();
        if (dummyPayload) ev.extra_payload = dummyPayload;
        events.push(ev);
      });

      if (this.onTelemetryCallback) {
        this.onTelemetryCallback(events);
      }
    };

    this.timer = setInterval(tick, this.config.tickIntervalMs);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public updateConfig(newConfig: Partial<FleetConfig>): FleetConfig {
    if (newConfig.fleetSize !== undefined && newConfig.fleetSize !== this.config.fleetSize) {
      this.config.fleetSize = Math.max(1, Math.min(10000, newConfig.fleetSize));
      this.syncFleetSize();
    }

    let intervalChanged = false;
    if (newConfig.tickIntervalMs !== undefined && newConfig.tickIntervalMs !== this.config.tickIntervalMs) {
      this.config.tickIntervalMs = Math.max(50, Math.min(30000, newConfig.tickIntervalMs));
      intervalChanged = true;
    }

    if (newConfig.payloadSizeBytes !== undefined) {
      this.config.payloadSizeBytes = Math.max(0, newConfig.payloadSizeBytes);
    }

    if (newConfig.simulateDisruptions !== undefined) {
      this.config.simulateDisruptions = newConfig.simulateDisruptions;
    }

    // Restart timer if interval changed
    if (intervalChanged && this.timer) {
      this.start();
    }

    return this.getConfig();
  }

  public getConfig(): FleetConfig {
    return { ...this.config };
  }

  public triggerDisruption(robotId: string, status: any): boolean {
    const robot = this.robots.get(robotId);
    if (robot) {
      robot.forceStatus(status);
      return true;
    }
    return false;
  }

  public getRobots(): Robot[] {
    return Array.from(this.robots.values());
  }
}
