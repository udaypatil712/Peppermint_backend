"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FleetSimulator_1 = require("../simulator/FleetSimulator");
const Robot_1 = require("../simulator/Robot");
describe('FleetSimulator Kinematics & Dynamic Scaling', () => {
    let simulator;
    beforeEach(() => {
        simulator = new FleetSimulator_1.FleetSimulator({ fleetSize: 8, tickIntervalMs: 100 });
    });
    afterEach(() => {
        simulator.stop();
    });
    test('should initialize with configured fleet size', () => {
        expect(simulator.getRobots().length).toBe(8);
    });
    test('should dynamically scale fleet size up to 50 without restarting', () => {
        simulator.updateConfig({ fleetSize: 50 });
        expect(simulator.getRobots().length).toBe(50);
    });
    test('should dynamically scale fleet size down to 3', () => {
        simulator.updateConfig({ fleetSize: 3 });
        expect(simulator.getRobots().length).toBe(3);
    });
    test('robot movement stays within site bounds (900x560)', () => {
        const robot = new Robot_1.Robot('r_test', 'cleaner', 100, 100, 80, 'active');
        for (let i = 0; i < 50; i++) {
            const event = robot.update(0.5, false);
            expect(event.x).toBeGreaterThanOrEqual(12);
            expect(event.x).toBeLessThanOrEqual(888);
            expect(event.y).toBeGreaterThanOrEqual(12);
            expect(event.y).toBeLessThanOrEqual(548);
        }
    });
    test('robot status disruption endpoint updates status correctly', () => {
        simulator.triggerDisruption('r1', 'blocked');
        const r1 = simulator.getRobots().find((r) => r.id === 'r1');
        expect(r1?.status).toBe('blocked');
    });
});
