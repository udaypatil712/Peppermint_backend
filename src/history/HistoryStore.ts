import { TelemetryEvent } from '../types';

export class HistoryStore {
  private historyMap: Map<string, TelemetryEvent[]> = new Map();
  private maxEventsPerRobot: number;

  constructor(maxEventsPerRobot: number = 300) {
    this.maxEventsPerRobot = maxEventsPerRobot;
  }

  public recordEvent(event: TelemetryEvent) {
    const list = this.historyMap.get(event.robot_id) || [];
    list.push(event);

    // Keep ring buffer constrained
    if (list.length > this.maxEventsPerRobot) {
      list.shift();
    }

    this.historyMap.set(event.robot_id, list);
  }

  public recordBatch(events: TelemetryEvent[]) {
    events.forEach((ev) => this.recordEvent(ev));
  }

  public getHistory(
    robotId: string,
    startTime?: number,
    endTime?: number,
    limit: number = 100
  ): TelemetryEvent[] {
    const list = this.historyMap.get(robotId) || [];
    let filtered = list;

    if (startTime !== undefined) {
      filtered = filtered.filter((e) => {
        const val = e.timestamp !== undefined ? e.timestamp : e.t;
        return val >= startTime;
      });
    }

    if (endTime !== undefined) {
      filtered = filtered.filter((e) => {
        const val = e.timestamp !== undefined ? e.timestamp : e.t;
        return val <= endTime;
      });
    }

    return filtered.slice(-limit);
  }

  public clearHistory(robotId?: string) {
    if (robotId) {
      this.historyMap.delete(robotId);
    } else {
      this.historyMap.clear();
    }
  }

  public getRobotCount(): number {
    return this.historyMap.size;
  }
}
