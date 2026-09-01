"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const HistoryStore_1 = require("../history/HistoryStore");
const IngestionPipeline_1 = require("../ingestion/IngestionPipeline");
describe('IngestionPipeline & HistoryStore Tests', () => {
    let historyStore;
    let pipeline;
    beforeEach(() => {
        historyStore = new HistoryStore_1.HistoryStore(10);
        pipeline = new IngestionPipeline_1.IngestionPipeline(historyStore);
    });
    test('should ingest events and update current fleet snapshot', () => {
        const sampleEvent = {
            t: 5,
            robot_id: 'r1',
            x: 120.5,
            y: 230.1,
            status: 'active',
            battery: 88.5,
            timestamp: 1000,
        };
        pipeline.ingest([sampleEvent]);
        const snapshot = pipeline.getCurrentSnapshot();
        expect(snapshot.length).toBe(1);
        expect(snapshot[0].robot_id).toBe('r1');
        expect(snapshot[0].x).toBe(120.5);
    });
    test('should constrain history ring buffer size per robot', () => {
        for (let i = 0; i < 25; i++) {
            historyStore.recordEvent({
                t: i,
                robot_id: 'r1',
                x: i * 10,
                y: i * 10,
                status: 'active',
                battery: 100 - i,
                timestamp: 1000 + i * 1000,
            });
        }
        const history = historyStore.getHistory('r1', undefined, undefined, 100);
        expect(history.length).toBe(10); // Constrained to max 10
        expect(history[0].t).toBe(15);
        expect(history[9].t).toBe(24);
    });
    test('should support time range filtering in history store', () => {
        historyStore.recordEvent({ t: 10, robot_id: 'r2', x: 1, y: 1, status: 'idle', battery: 90, timestamp: 1000 });
        historyStore.recordEvent({ t: 20, robot_id: 'r2', x: 2, y: 2, status: 'idle', battery: 89, timestamp: 2000 });
        historyStore.recordEvent({ t: 30, robot_id: 'r2', x: 3, y: 3, status: 'idle', battery: 88, timestamp: 3000 });
        const filtered = historyStore.getHistory('r2', 1500, 2500);
        expect(filtered.length).toBe(1);
        expect(filtered[0].t).toBe(20);
    });
});
