import { RobotStatus, RobotType, TelemetryEvent } from '../types';

// These roughly match the layout.png zones where robots should not go
const OBSTACLES = [
  { x1: 150, y1: 60, x2: 350, y2: 140 },
  { x1: 150, y1: 200, x2: 350, y2: 280 },
  { x1: 150, y1: 360, x2: 350, y2: 440 },
  { x1: 500, y1: 60, x2: 560, y2: 460 },
  { x1: 650, y1: 150, x2: 850, y2: 210 },
  { x1: 650, y1: 340, x2: 850, y2: 400 },
];

const W = 900;
const H = 560;
const MARGIN = 12;

function inObstacle(x: number, y: number): boolean {
  const pad = 8;
  return OBSTACLES.some(
    (o) => x > o.x1 - pad && x < o.x2 + pad && y > o.y1 - pad && y < o.y2 + pad
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export class Robot {
  public id: string;
  public type: RobotType;
  public x: number;
  public y: number;
  public battery: number;
  public status: RobotStatus;

  // velocity in units per second
  private vx: number;
  private vy: number;
  private statusAge: number = 0;
  // when on_mission, robots head toward a waypoint
  private waypointX: number | null = null;
  private waypointY: number | null = null;

  constructor(
    id: string,
    type: RobotType,
    startX: number,
    startY: number,
    battery: number,
    status: RobotStatus
  ) {
    this.id = id;
    this.type = type;
    this.battery = Number(battery.toFixed(1));
    this.status = status;

    // place the robot somewhere valid
    let x = startX, y = startY;
    let tries = 0;
    while (inObstacle(x, y) && tries++ < 50) {
      x = MARGIN + Math.random() * (W - 2 * MARGIN);
      y = MARGIN + Math.random() * (H - 2 * MARGIN);
    }
    this.x = clamp(x, MARGIN, W - MARGIN);
    this.y = clamp(y, MARGIN, H - MARGIN);

    const speed = 4 + Math.random() * 4; // 4–8 units/sec — clearly visible motion
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  public update(dtSec: number, disruptions: boolean): TelemetryEvent {
    this.statusAge += dtSec;
    this.runStatusMachine(disruptions);
    this.move(dtSec);

    return {
      t: 0, // filled by simulator
      robot_id: this.id,
      x: Number(this.x.toFixed(1)),
      y: Number(this.y.toFixed(1)),
      status: this.status,
      battery: Number(this.battery.toFixed(1)),
      robot_type: this.type,
    };
  }

  private move(dtSec: number) {
    if (this.status === 'offline' || this.status === 'charging' || this.status === 'maintenance') {
      // physically stationary — just tick battery
      if (this.status === 'charging') {
        this.battery = Math.min(100, Number((this.battery + 0.4 * dtSec).toFixed(2)));
        if (this.battery >= 98) this.status = 'idle';
      } else {
        this.battery = Math.max(0, Number((this.battery - 0.003 * dtSec).toFixed(2)));
      }
      return;
    }

    if (this.status === 'idle') {
      // idle robots do drift very slowly — just enough to confirm they're alive
      const speed = 0.8;
      this.x += this.vx * speed * dtSec;
      this.y += this.vy * speed * dtSec;
      this.battery = Math.max(0, Number((this.battery - 0.002 * dtSec).toFixed(2)));
      this.bounceAndClamp();
      return;
    }

    if (this.status === 'blocked' || this.status === 'error') {
      // not moving, just draining very slowly
      this.battery = Math.max(0, Number((this.battery - 0.001 * dtSec).toFixed(2)));
      return;
    }

    // active / on_mission — move at full speed
    if (this.status === 'on_mission' && this.waypointX !== null) {
      // steer toward waypoint
      const dx = this.waypointX - this.x;
      const dy = this.waypointY! - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 10) {
        // arrived
        this.waypointX = null;
        this.waypointY = null;
      } else {
        const speed = 6 + Math.random() * 3;
        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
      }
    }

    this.x += this.vx * dtSec;
    this.y += this.vy * dtSec;
    this.battery = Math.max(0, Number((this.battery - 0.025 * dtSec).toFixed(2)));
    this.bounceAndClamp();

    const st = this.status as string;
    if (this.battery <= 8 && st !== 'charging') {
      this.status = 'charging';
    }
  }

  private bounceAndClamp() {
    // hard boundary bounce
    if (this.x < MARGIN) { this.x = MARGIN; this.vx = Math.abs(this.vx); }
    if (this.x > W - MARGIN) { this.x = W - MARGIN; this.vx = -Math.abs(this.vx); }
    if (this.y < MARGIN) { this.y = MARGIN; this.vy = Math.abs(this.vy); }
    if (this.y > H - MARGIN) { this.y = H - MARGIN; this.vy = -Math.abs(this.vy); }

    // obstacle bounce — check and reflect
    if (inObstacle(this.x + this.vx * 0.1, this.y)) {
      this.vx = -this.vx + (Math.random() - 0.5) * 2; // add tiny jitter so they don't get stuck
    }
    if (inObstacle(this.x, this.y + this.vy * 0.1)) {
      this.vy = -this.vy + (Math.random() - 0.5) * 2;
    }
  }

  private runStatusMachine(disruptions: boolean) {
    if (!disruptions) return;

    // each status has its own sojourn time
    const sojourn: Record<RobotStatus, number> = {
      idle: 12 + Math.random() * 15,
      active: 20 + Math.random() * 20,
      on_mission: 30 + Math.random() * 30,
      blocked: 8 + Math.random() * 10,
      error: 10 + Math.random() * 15,
      maintenance: 15 + Math.random() * 20,
      charging: 999, // handled by battery level
      offline: 20 + Math.random() * 40,
    };

    if (this.statusAge < sojourn[this.status]) return;
    this.statusAge = 0;

    const r = Math.random();
    switch (this.status) {
      case 'idle':
        if (r < 0.55) this.status = 'active';
        else if (r < 0.8) this.status = 'on_mission';
        else if (r < 0.9) this.status = 'maintenance';
        // else stay idle
        if (this.status === 'on_mission') this.pickWaypoint();
        break;
      case 'active':
        if (r < 0.5) this.status = 'idle';
        else if (r < 0.7) { this.status = 'on_mission'; this.pickWaypoint(); }
        else if (r < 0.82) this.status = 'blocked';
        else if (r < 0.92) this.status = 'error';
        else this.status = 'charging';
        break;
      case 'on_mission':
        if (r < 0.4) this.status = 'idle';
        else if (r < 0.65) this.status = 'active';
        else if (r < 0.78) this.status = 'blocked';
        else if (r < 0.88) this.status = 'error';
        else this.status = 'charging';
        break;
      case 'blocked':
        this.status = r < 0.7 ? 'active' : 'error';
        break;
      case 'error':
        this.status = r < 0.6 ? 'maintenance' : 'idle';
        break;
      case 'maintenance':
        this.status = 'idle';
        break;
      case 'offline':
        if (r < 0.6) this.status = 'idle';
        break;
    }
  }

  private pickWaypoint() {
    // pick a random open area on the map
    let wx, wy, attempts = 0;
    do {
      wx = MARGIN + Math.random() * (W - 2 * MARGIN);
      wy = MARGIN + Math.random() * (H - 2 * MARGIN);
    } while (inObstacle(wx, wy) && ++attempts < 20);
    this.waypointX = wx;
    this.waypointY = wy;
  }

  public forceStatus(s: RobotStatus) {
    this.status = s;
    this.statusAge = 0;
  }
}
