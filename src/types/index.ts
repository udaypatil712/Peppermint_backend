export type RobotStatus = 
  | 'idle' 
  | 'active' 
  | 'on_mission' 
  | 'charging' 
  | 'blocked' 
  | 'error' 
  | 'maintenance' 
  | 'offline';

export type RobotType = 'cleaner' | 'scrubber' | 'tug' | 'inspection';

export interface TelemetryEvent {
  t: number;             // Seconds from start window
  robot_id: string;
  x: number;
  y: number;
  status: RobotStatus;
  battery: number;       // Percentage 0-100
  task_event?: 'task_started' | 'task_completed';
  robot_type?: RobotType;
  extra_payload?: string; // Configurable dummy payload size testing
  timestamp?: number;     // Absolute unix timestamp ms
}

export interface RobotRosterEntry {
  robot_id: string;
  robot_type: RobotType;
  x: number;
  y: number;
  battery: number;
  status: RobotStatus;
}

export interface FleetConfig {
  fleetSize: number;
  tickIntervalMs: number;
  payloadSizeBytes: number;
  simulateDisruptions: boolean;
  apiKey?: string;
}

export interface SystemMetrics {
  totalIngested: number;
  eventsPerSec: number;
  activeConnections: number;
  uptimeSeconds: number;
  lastTickMs: number;
}
