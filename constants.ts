export const RADAR_RANGE_NM = 80;
export const REFRESH_RATE_MS = 1000; // 1 second radar sweep simulation
export const SIMULATION_TICK_MS = 1000; 
export const MISSILE_SPEED_KTS = 1200;
export const INTERCEPT_RANGE_NM = 5;

export const INITIAL_LOGS = [
  {
    id: 'init-1',
    timestamp: '0800:00',
    sender: 'CIC',
    content: 'SYSTEM STARTUP COMPLETE. SPY-1 RADAR ONLINE.',
    priority: 'normal'
  },
  {
    id: 'init-2',
    timestamp: '0800:05',
    sender: 'BRIDGE',
    content: 'TAO, this is Captain. We are entering the exclusion zone. Rules of Engagement are TIGHT. Do not fire unless fired upon or hostile intent is verified.',
    priority: 'high'
  }
] as const;