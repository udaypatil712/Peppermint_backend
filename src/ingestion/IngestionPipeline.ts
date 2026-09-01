import { TelemetryEvent, SystemMetrics } from '../types';
import { HistoryStore } from '../history/HistoryStore';

export class IngestionPipeline {
  private currentState: Map<string, TelemetryEvent> = new Map();
  private historyStore: HistoryStore;
  private totalIngested: number = 0;
  private recentIngestedCount: number = 0;
  private currentEventsPerSec: number = 0;
  private startTime: number = Date.now();
  private lastTickMs: number = 0;
  private subscribers: Set<(events: TelemetryEvent[]) => void> = new Set();

  constructor(historyStore: HistoryStore) {
    this.historyStore = historyStore;

    // Calculate events/sec window every 1 sec
    const timer = setInterval(() => {
      this.currentEventsPerSec = this.recentIngestedCount;
      this.recentIngestedCount = 0;
    }, 1000);
    if (timer.unref) timer.unref();
  }

  public ingest(events: TelemetryEvent[]) {
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
      } catch (err) {
        console.error('Error in subscriber broadcast callback:', err);
      }
    });

    this.lastTickMs = performance.now() - startTime;
  }

  public subscribe(cb: (events: TelemetryEvent[]) => void) {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  public getCurrentSnapshot(): TelemetryEvent[] {
    return Array.from(this.currentState.values());
  }

  public getMetrics(activeConnections: number): SystemMetrics {
    return {
      totalIngested: this.totalIngested,
      eventsPerSec: this.currentEventsPerSec,
      activeConnections,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      lastTickMs: Number(this.lastTickMs.toFixed(3)),
    };
  }
}
