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

export interface Track {
  id: string;
  callsign: string;
  position: Position;
  vector: {
    heading: number; // Degrees 0-359
    speed: number;   // Knots
  };
  altitude: number; // Feet
  identity: TrackIdentity;
  type: TrackType;
  engagementStatus: EngagementStatus;
  lastUpdated: number;
  history: Position[]; // Trail
  responsive?: boolean; // Whether the track responds to queries
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