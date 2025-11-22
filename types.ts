export enum TrackIdentity {
  UNKNOWN = 'UNKNOWN',
  FRIEND = 'FRIEND',
  HOSTILE = 'HOSTILE',
  NEUTRAL = 'NEUTRAL',
  PENDING = 'PENDING'
}

export enum TrackType {
  AIR = 'AIR',
  SURFACE = 'SURFACE',
  MISSILE = 'MISSILE'
}

export enum EngagementStatus {
  NONE = 'NONE',
  TRACKING = 'TRACKING',
  LOCK_ON = 'LOCK_ON',
  FIRING = 'FIRING',
  DESTROYED = 'DESTROYED'
}

export interface Position {
  x: number; // Nautical Miles from ownship (East is +)
  y: number; // Nautical Miles from ownship (North is +)
}

export interface Vector {
  heading: number; // Degrees 0-359
  speed: number;   // Knots
}

export enum TrackRole {
  FIGHTER = 'FIGHTER',
  ATTACK = 'ATTACK',
  NONE = 'NONE'
}

export interface Track {
  id: string;
  callsign: string;
  position: Position;
  vector: Vector;
  altitude: number; // Feet
  identity: TrackIdentity; // Displayed identity
  actualIdentity?: TrackIdentity; // Ground truth identity
  type: TrackType;
  role?: TrackRole; // Optional role for air contacts
  engagementStatus: EngagementStatus;
  lastUpdated: number;
  history: Position[]; // Trail
  responsive?: boolean; // Whether the track responds to queries
  ammo?: number; // Remaining missiles
  targetId?: string; // For missiles: ID of the target track
  defending?: boolean; // Whether the track is currently evading a missile
}

export interface LogMessage {
  id: string;
  timestamp: string;
  sender: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export enum GamePhase {
  BRIEFING = 'BRIEFING',
  ACTIVE = 'ACTIVE',
  DEBRIEFING = 'DEBRIEFING'
}

export interface GameState {
  phase: GamePhase;
  score: number;
  alertLevel: 'WHITE' | 'YELLOW' | 'RED';
  weaponsFree: boolean;
}