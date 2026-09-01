"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionPipeline = void 0;
class IngestionPipeline {
    currentState = new Map();
    historyStore;
    totalIngested = 0;
    recentIngestedCount = 0;
    currentEventsPerSec = 0;
    startTime = Date.now();
    lastTickMs = 0;
    subscribers = new Set();
    constructor(historyStore) {
        this.historyStore = historyStore;
        // Calculate events/sec window every 1 sec
        const timer = setInterval(() => {
            this.currentEventsPerSec = this.recentIngestedCount;
            this.recentIngestedCount = 0;
        }, 1000);
        if (timer.unref)
            timer.unref();
    }
    ingest(events) {
        const startTime = performance.now();
        this.totalIngested += events.length;
        this.recentIngestedCount += events.length;
        // 1. Update Current Fleet State Snapshot
        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            this.currentState.set(ev.robot_id, ev);
        }
        // 2. Persist to History Ring-Buffer Store asynchronously
        this.historyStore.recordBatch(events);
        // 3. Notify Subscribers (WebSocket Broadcaster)
        this.subscribers.forEach((cb) => {
            try {
                cb(events);
            }
            catch (err) {
                console.error('Error in subscriber broadcast callback:', err);
            }
        });
        this.lastTickMs = performance.now() - startTime;
    }
    subscribe(cb) {
        this.subscribers.add(cb);
        return () => this.subscribers.delete(cb);
    }
    getCurrentSnapshot() {
        return Array.from(this.currentState.values());
    }
    getMetrics(activeConnections) {
        return {
            totalIngested: this.totalIngested,
            eventsPerSec: this.currentEventsPerSec,
            activeConnections,
            uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
            lastTickMs: Number(this.lastTickMs.toFixed(3)),
        };
    }
}
exports.IngestionPipeline = IngestionPipeline;
