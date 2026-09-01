"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetSimulator = void 0;
const Robot_1 = require("./Robot");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class FleetSimulator {
    robots = new Map();
    config;
    timer = null;
    startTime = Date.now();
    onTelemetryCallback = null;
    initialRoster = [];
    constructor(config = {}) {
        this.config = {
            fleetSize: config.fleetSize ?? 8,
            tickIntervalMs: config.tickIntervalMs ?? 1000,
            payloadSizeBytes: config.payloadSizeBytes ?? 0,
            simulateDisruptions: config.simulateDisruptions ?? true,
        };
        this.loadInitialRoster();
        this.syncFleetSize();
    }
    loadInitialRoster() {
        try {
            const rosterPath = path_1.default.resolve(__dirname, '../../../robots.json');
            if (fs_1.default.existsSync(rosterPath)) {
                const raw = fs_1.default.readFileSync(rosterPath, 'utf-8');
                this.initialRoster = JSON.parse(raw);
            }
        }
        catch (e) {
            console.warn('Could not load robots.json, fallback to auto-generated roster:', e);
        }
    }
    syncFleetSize() {
        const currentSize = this.robots.size;
        const targetSize = this.config.fleetSize;
        if (targetSize > currentSize) {
            // Add robots
            for (let i = currentSize + 1; i <= targetSize; i++) {
                const id = `r${i}`;
                // Check if initial roster has this robot
                const initial = this.initialRoster.find((r) => r.robot_id === id);
                if (initial) {
                    this.robots.set(id, new Robot_1.Robot(id, initial.robot_type, initial.x, initial.y, initial.battery, initial.status));
                }
                else {
                    const types = ['cleaner', 'scrubber', 'tug', 'inspection'];
                    const randType = types[Math.floor(Math.random() * types.length)];
                    const rx = 15 + Math.random() * 870;
                    const ry = 15 + Math.random() * 530;
                    const rb = 30 + Math.random() * 70;
                    this.robots.set(id, new Robot_1.Robot(id, randType, rx, ry, rb, 'idle'));
                }
            }
        }
        else if (targetSize < currentSize) {
            // Scale down robots
            const keys = Array.from(this.robots.keys());
            for (let i = targetSize; i < keys.length; i++) {
                this.robots.delete(keys[i]);
            }
        }
    }
    setOnTelemetry(cb) {
        this.onTelemetryCallback = cb;
    }
    start() {
        if (this.timer)
            clearInterval(this.timer);
        this.startTime = Date.now();
        const tick = () => {
            const deltaSeconds = this.config.tickIntervalMs / 1000;
            const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            const events = [];
            const dummyPayload = this.config.payloadSizeBytes > 0
                ? 'X'.repeat(this.config.payloadSizeBytes)
                : undefined;
            this.robots.forEach((robot) => {
                const ev = robot.update(deltaSeconds, this.config.simulateDisruptions);
                ev.t = elapsedSeconds;
                ev.timestamp = Date.now();
                if (dummyPayload)
                    ev.extra_payload = dummyPayload;
                events.push(ev);
            });
            if (this.onTelemetryCallback) {
                this.onTelemetryCallback(events);
            }
        };
        this.timer = setInterval(tick, this.config.tickIntervalMs);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    updateConfig(newConfig) {
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
    getConfig() {
        return { ...this.config };
    }
    triggerDisruption(robotId, status) {
        const robot = this.robots.get(robotId);
        if (robot) {
            robot.forceStatus(status);
            return true;
        }
        return false;
    }
    getRobots() {
        return Array.from(this.robots.values());
    }
}
exports.FleetSimulator = FleetSimulator;
