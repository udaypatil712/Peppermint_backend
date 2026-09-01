"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryStore = void 0;
class HistoryStore {
    historyMap = new Map();
    maxEventsPerRobot;
    constructor(maxEventsPerRobot = 300) {
        this.maxEventsPerRobot = maxEventsPerRobot;
    }
    recordEvent(event) {
        const list = this.historyMap.get(event.robot_id) || [];
        list.push(event);
        // Keep ring buffer constrained
        if (list.length > this.maxEventsPerRobot) {
            list.shift();
        }
        this.historyMap.set(event.robot_id, list);
    }
    recordBatch(events) {
        events.forEach((ev) => this.recordEvent(ev));
    }
    getHistory(robotId, startTime, endTime, limit = 100) {
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
    clearHistory(robotId) {
        if (robotId) {
            this.historyMap.delete(robotId);
        }
        else {
            this.historyMap.clear();
        }
    }
    getRobotCount() {
        return this.historyMap.size;
    }
}
exports.HistoryStore = HistoryStore;
