import React, { useState, useEffect, useCallback, useRef } from 'react';
import RadarDisplay from './components/RadarDisplay';
import CommsLog from './components/CommsLog';
import ControlPanel from './components/ControlPanel';
import { Track, TrackIdentity, LogMessage, GamePhase, EngagementStatus, TrackType, TrackRole } from './types';
import { INITIAL_LOGS, SIMULATION_TICK_MS, MISSILE_SPEED_KTS, INTERCEPT_RANGE_NM } from './constants';
import { generateScenario, generateChatter, generateDebrief } from './services/geminiService';
import { Play, Activity, Shield, AlertTriangle, Skull } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [phase, setPhase] = useState<GamePhase>(GamePhase.BRIEFING);
  const [radarRange, setRadarRange] = useState<number>(200);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [logs, setLogs] = useState<LogMessage[]>([...INITIAL_LOGS]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [weaponsFree, setWeaponsFree] = useState(false);
  const [scenarioDesc, setScenarioDesc] = useState<string>("");
  const [score, setScore] = useState(100);
  const [debriefText, setDebriefText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // --- Constants for Physics ---
  const OWNSHIP_VECTOR = { heading: 0, speed: 20 }; // Moving North at 20kts
  const TIME_ACCELERATION = 10; // 1 sec real time = 10 sec sim time

  // --- Refs for Simulation Loop & Async Access ---
  const tracksRef = useRef<Track[]>([]);

  // Sync Ref with State
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // --- Logging Helper ---
  const addLog = useCallback((sender: string, content: string, priority: LogMessage['priority'] = 'normal') => {
    const newLog: LogMessage = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      sender,
      content,
      priority
    };
    setLogs(prev => [...prev, newLog]);
  }, []);

  // --- Initialization ---
  const startScenario = async () => {
    setLoading(true);
    setPhase(GamePhase.ACTIVE);
    try {
      const scenario = await generateScenario();
      setScenarioDesc(scenario.description);
      addLog("SYSTEM", `SCENARIO LOADED: ${scenario.description}`, 'high');

      // 1. Convert Scenario Tracks
      const scenarioTracks: Track[] = scenario.tracks.map((t: any, idx: number) => {
        const groundTruth = t.identity || TrackIdentity.UNKNOWN;
        // Mask identity: FRIEND stays FRIEND (IFF), others UNKNOWN
        const initialIdentity = groundTruth === TrackIdentity.FRIEND ? TrackIdentity.FRIEND : TrackIdentity.UNKNOWN;

        return {
          id: `trk-${idx}`,
          callsign: t.callsign || `UNK-${1000 + idx}`,
          position: t.position || { x: 20, y: 20 },
          vector: t.vector || { heading: 180, speed: 300 },
          altitude: t.altitude || 20000,
          identity: initialIdentity,
          actualIdentity: groundTruth,
          type: t.type || TrackType.AIR,
          role: t.role || TrackRole.NONE,
          engagementStatus: EngagementStatus.NONE,
          lastUpdated: Date.now(),
          history: [],
          responsive: t.responsive,
          ammo: (t.role === TrackRole.FIGHTER || t.role === TrackRole.ATTACK) ? 2 : 0
        };
      });

      // 2. Add Formation Ships (Fixed relative to start)
      const formationTracks: Track[] = [
        {
          id: 'own-escort-1',
          callsign: 'USS STOUT',
          position: { x: -6, y: -2 }, // Port quarter
          vector: { ...OWNSHIP_VECTOR }, // Matching speed/course
          altitude: 0,
          identity: TrackIdentity.FRIEND,
          actualIdentity: TrackIdentity.FRIEND,
          type: TrackType.SURFACE,
          engagementStatus: EngagementStatus.NONE,
          lastUpdated: Date.now(),
          history: []
        },
        {
          id: 'own-escort-2',
          callsign: 'USS ARLEIGH BURKE',
          position: { x: 6, y: -2 }, // Starboard quarter
          vector: { ...OWNSHIP_VECTOR }, // Matching speed/course
          altitude: 0,
          identity: TrackIdentity.FRIEND,
          actualIdentity: TrackIdentity.FRIEND,
          type: TrackType.SURFACE,
          engagementStatus: EngagementStatus.NONE,
          lastUpdated: Date.now(),
          history: []
        },
        {
          id: 'own-picket-1',
          callsign: 'USS PRINCETON',
          position: { x: 0, y: 10 }, // Picket ahead
          vector: { ...OWNSHIP_VECTOR },
          altitude: 0,
          identity: TrackIdentity.FRIEND,
          actualIdentity: TrackIdentity.FRIEND,
          type: TrackType.SURFACE,
          engagementStatus: EngagementStatus.NONE,
          lastUpdated: Date.now(),
          history: []
        },
        {
          id: 'own-hawkeye-1',
          callsign: ['STEELJAW', 'EAGLE', 'HUMMER'][Math.floor(Math.random() * 3)],
          position: { x: 20, y: 45 }, // Orbiting station
          vector: { heading: 90, speed: 250 },
          altitude: 25000,
          identity: TrackIdentity.FRIEND,
          actualIdentity: TrackIdentity.FRIEND,
          type: TrackType.AIR,
          engagementStatus: EngagementStatus.NONE,
          lastUpdated: Date.now(),
          history: []
        }
      ];

      setTracks([...formationTracks, ...scenarioTracks]);
    } catch (e) {
      addLog("SYSTEM", "SCENARIO GENERATION FAILED", 'critical');
    } finally {
      setLoading(false);
    }
  };

  // --- Game Loop (1Hz) ---
  useEffect(() => {
    if (phase !== GamePhase.ACTIVE) return;

    const interval = setInterval(() => {
      setTracks(currentTracks => {
        const now = Date.now();

        // Calculate Hours per tick for movement
        const hoursPerTick = (SIMULATION_TICK_MS / 3600000) * TIME_ACCELERATION;

        let newMissiles: Track[] = [];

        let updatedTracks = currentTracks.map(track => {
          // 0. AI Logic (Hostiles Only)
          // Use actualIdentity for AI behavior
          if (track.actualIdentity === TrackIdentity.HOSTILE && track.type === TrackType.AIR && track.engagementStatus !== EngagementStatus.DESTROYED) {
            // Fighter Logic
            if (track.role === TrackRole.FIGHTER) {
              // Target Blue Air (Hawkeye)
              const target = currentTracks.find(t => t.id === 'own-hawkeye-1');
              const targetDestroyed = !target || target.engagementStatus === EngagementStatus.DESTROYED;

              if (targetDestroyed) {
                // Egress Logic: Run away from ownship (0,0)
                const dX = track.position.x - 0;
                const dY = track.position.y - 0;
                const escapeAngle = Math.atan2(dY, dX) * (180 / Math.PI);
                track.vector.heading = (90 - escapeAngle + 360) % 360;
                track.vector.speed = 1000; // Max speed egress
              } else {
                // Move towards target
                const dX = target.position.x - track.position.x;
                const dY = target.position.y - track.position.y;
                const targetAngle = Math.atan2(dY, dX) * (180 / Math.PI);
                track.vector.heading = (90 - targetAngle + 360) % 360;
                track.vector.speed = 800; // Afterburners

                // Fire AAM if in range (e.g. 40nm) and has ammo
                const dist = Math.sqrt(dX * dX + dY * dY);
                if (dist < 40 && (track.ammo || 0) > 0 && Math.random() < 0.05) {
                  newMissiles.push({
                    id: `msl-hostile-${Date.now()}-${Math.random()}`,
                    callsign: `AAM->${target.id}`,
                    position: { ...track.position },
                    vector: { heading: track.vector.heading, speed: 2000 },
                    altitude: track.altitude,
                    identity: TrackIdentity.HOSTILE,
                    actualIdentity: TrackIdentity.HOSTILE,
                    type: TrackType.MISSILE,
                    engagementStatus: EngagementStatus.FIRING,
                    lastUpdated: now,
                    history: []
                  });
                  track.ammo = (track.ammo || 0) - 1;
                  addLog("EW", `VAMPIRE! VAMPIRE! Inbound missile from ${track.callsign}!`, 'critical');
                }
              }
            }
            // Attack Logic
            else if (track.role === TrackRole.ATTACK) {
              // Target Surface (Ownship)
              const target = { position: { x: 0, y: 0 }, id: 'ownship' }; // Ownship is at 0,0 relative

              // Check ammo status
              if ((track.ammo || 0) <= 0) {
                // Egress Logic: Run away from ownship
                const dX = track.position.x - 0;
                const dY = track.position.y - 0;
                const escapeAngle = Math.atan2(dY, dX) * (180 / Math.PI);
                track.vector.heading = (90 - escapeAngle + 360) % 360;
                track.vector.speed = 800; // Max speed egress
              } else {
                // Move towards target
                const dX = target.position.x - track.position.x;
                const dY = target.position.y - track.position.y;
                const targetAngle = Math.atan2(dY, dX) * (180 / Math.PI);
                track.vector.heading = (90 - targetAngle + 360) % 360;
                track.vector.speed = 450; // Subsonic attack

                // Fire ASM if in range (e.g. 60nm)
                const dist = Math.sqrt(dX * dX + dY * dY);
                if (dist < 60 && (track.ammo || 0) > 0 && Math.random() < 0.02) {
                  newMissiles.push({
                    id: `msl-hostile-${Date.now()}-${Math.random()}`,
                    callsign: `ASM->${target.id}`,
                    position: { ...track.position },
                    vector: { heading: track.vector.heading, speed: 600 }, // Slower ASM
                    altitude: 100, // Sea skimmer
                    identity: TrackIdentity.HOSTILE,
                    actualIdentity: TrackIdentity.HOSTILE,
                    type: TrackType.MISSILE,
                    engagementStatus: EngagementStatus.FIRING,
                    lastUpdated: now,
                    history: []
                  });
                  track.ammo = (track.ammo || 0) - 1;
                  addLog("EW", `VAMPIRE! VAMPIRE! Inbound anti-ship missile from ${track.callsign}!`, 'critical');
                }
              }
            }
          }

          // 1. Relative Movement Physics
          // Decompose Ownship Vector
          const ownRads = (90 - OWNSHIP_VECTOR.heading) * (Math.PI / 180);
          const ownVx = Math.cos(ownRads) * OWNSHIP_VECTOR.speed;
          const ownVy = Math.sin(ownRads) * OWNSHIP_VECTOR.speed;

          // Decompose Track Vector
          const trackRads = (90 - track.vector.heading) * (Math.PI / 180);
          const trackVx = Math.cos(trackRads) * track.vector.speed;
          const trackVy = Math.sin(trackRads) * track.vector.speed;

          // Relative Velocity
          const relVx = trackVx - ownVx;
          const relVy = trackVy - ownVy;

          // Apply Movement
          const dx = relVx * hoursPerTick;
          const dy = relVy * hoursPerTick;

          let newPos = {
            x: track.position.x + dx,
            y: track.position.y + dy
          };

          // 2. Logic for Missiles
          if (track.type === TrackType.MISSILE) {
            // Missile Logic: Updates its heading to point to target
            const targetId = track.callsign.split('->')[1];

            let target: Track | undefined;
            let targetPos = { x: 0, y: 0 }; // Default to ownship

            if (targetId === 'ownship') {
              targetPos = { x: 0, y: 0 };
            } else {
              target = currentTracks.find(t => t.id === targetId);
              if (target) targetPos = target.position;
            }

            if ((targetId === 'ownship') || (target && target.engagementStatus !== EngagementStatus.DESTROYED)) {
              // Update vector to point at target
              const dX = targetPos.x - track.position.x;
              const dY = targetPos.y - track.position.y;
              const targetAngle = Math.atan2(dY, dX) * (180 / Math.PI);
              const newHeading = (90 - targetAngle + 360) % 360;

              track.vector.heading = newHeading;

              // Check hit
              const distToTarget = Math.sqrt(dX * dX + dY * dY);
              if (distToTarget < INTERCEPT_RANGE_NM) {
                if (track.identity === TrackIdentity.FRIEND) {
                  addLog("FC", `SPLASH TARGET ${target?.callsign}!`, 'high');
                  return { ...track, engagementStatus: EngagementStatus.DESTROYED };
                } else {
                  // Hostile hit
                  if (targetId === 'ownship') {
                    addLog("DC", `IMPACT! WE ARE HIT!`, 'critical');
                    setScore(s => s - 100);
                  } else {
                    addLog("EW", `Lost contact ${target?.callsign}`, 'critical');
                    setScore(s => s - 50);
                  }
                  return { ...track, engagementStatus: EngagementStatus.DESTROYED };
                }
              }
            } else {
              return { ...track, engagementStatus: EngagementStatus.DESTROYED };
            }
          }

          return {
            ...track,
            position: newPos,
            lastUpdated: now,
            vector: { ...track.vector }
          };
        });

        // Add new missiles
        updatedTracks = [...updatedTracks, ...newMissiles];

        // 3. Handle Collisions / Destructions from Step 2
        const missiles = updatedTracks.filter(t => t.type === TrackType.MISSILE && t.engagementStatus === EngagementStatus.DESTROYED);
        missiles.forEach(m => {
          const targetId = m.callsign.split('->')[1];

          if (targetId === 'ownship') {
            // Ownship damage logic handled above
          } else {
            const targetIndex = updatedTracks.findIndex(t => t.id === targetId);
            if (targetIndex !== -1) {
              // Destroy target if hit by ANY missile (Friend or Hostile)
              // But we should probably only destroy if it's a valid hit (Hostile -> Friend/Neutral, Friend -> Hostile/Neutral/Friend)
              // For simplicity, if a missile hits a target, the target is destroyed.

              updatedTracks[targetIndex] = {
                ...updatedTracks[targetIndex],
                engagementStatus: EngagementStatus.DESTROYED,
                vector: { ...updatedTracks[targetIndex].vector, speed: 0 }
              };

              // Score logic
              if (m.identity === TrackIdentity.FRIEND) {
                // Blue missile hit something
                if (updatedTracks[targetIndex].actualIdentity === TrackIdentity.HOSTILE) {
                  setScore(s => s + 50);
                } else {
                  // Blue on Blue / Blue on Neutral
                  setScore(s => s - 200);
                  addLog("BRIDGE", "CEASE FIRE! BLUE ON BLUE!", 'critical');
                }
              } else {
                // Red missile hit something (already penalized in step 2, but maybe add more logic here if needed)
              }
            }
          }
        });

        updatedTracks = updatedTracks.filter(t => !(t.type === TrackType.MISSILE && t.engagementStatus === EngagementStatus.DESTROYED));

        return updatedTracks;
      });
    }, SIMULATION_TICK_MS);

    return () => clearInterval(interval);
  }, [phase, addLog]);

  // --- Actions ---

  const handleIdentify = async (id: string, identity: TrackIdentity) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, identity } : t));
    // We use tracksRef here to get metadata safely for logging without depending on 'tracks' in useCallback
    const track = tracksRef.current.find(t => t.id === id);
    if (track) {
      addLog("TAO", `Classifying track ${track.callsign} as ${identity}`);
      // Sim chatter
      // Don't await chatter for ID change to keep UI snappy
      generateChatter("Classification Changed", `Target ${track.callsign} marked as ${identity} by TAO.`)
        .then(chatter => addLog("TIC", chatter));
    }
  };

  const handleWarning = async (id: string) => {
    const track = tracksRef.current.find(t => t.id === id);
    if (!track) return;

    addLog("COMS", `Transmitting query to ${track.callsign} on Int'l Air Distress...`);

    setTimeout(async () => {
      // Re-fetch track from ref to ensure we have latest state (including identity changes)
      const currentTrack = tracksRef.current.find(t => t.id === id);
      if (!currentTrack) return;

      if (currentTrack.responsive === false) {
        addLog("COMS", `No response from ${currentTrack.callsign}.`, 'high');
      } else {
        try {
          const resp = await generateChatter(`Civilian Response`, `Civilian aircraft ${currentTrack.callsign} responding to query, stating they are off course.`);
          addLog("AIR", `"${resp}"`, 'normal');
          // Only mark neutral if not already friendly/hostile decision made
          if (currentTrack.identity === TrackIdentity.UNKNOWN || currentTrack.identity === TrackIdentity.PENDING) {
            handleIdentify(id, TrackIdentity.NEUTRAL);
          }
        } catch (e) {
          console.error("Chatter generation failed", e);
        }
      }
    }, 2000);
  };

  const handleEngage = async (id: string) => {
    if (!weaponsFree) {
      addLog("TAO", "Cannot fire! Weapons Tight!", 'critical');
      return;
    }

    const target = tracks.find(t => t.id === id);
    if (!target) return;

    addLog("TAO", `Birds away on ${target.callsign}!`);

    const missile: Track = {
      id: `msl-${Date.now()}`,
      callsign: `SM-2->${target.id}`,
      position: { x: 0, y: 0 }, // Launch from ownship center
      vector: { heading: 0, speed: MISSILE_SPEED_KTS },
      altitude: 1000,
      identity: TrackIdentity.FRIEND,
      type: TrackType.MISSILE,
      engagementStatus: EngagementStatus.FIRING,
      lastUpdated: Date.now(),
      history: []
    };

    setTracks(prev => [...prev, missile]);

    const chatter = await generateChatter("Missile Launch", "Standard Missile 2 launched from VLS.");
    addLog("MSS", chatter);
  };

  const handleEndGame = async () => {
    setPhase(GamePhase.DEBRIEFING);
    const debrief = await generateDebrief(logs, score);
    setDebriefText(debrief);
  };

  // --- Render ---

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-950 text-gray-200 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-12 bg-slate-900 border-b border-slate-700 flex items-center px-4 justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Shield className="text-tactical-green" />
          <h1 className="font-mono font-bold text-lg tracking-wider text-tactical-green">AEGIS COMBAT SYSTEM <span className="text-xs text-gray-500">MK7 MOD 4</span></h1>
        </div>

        <div className="flex items-center gap-6 font-mono text-sm">
          <div className={`flex items-center gap-2 ${weaponsFree ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
            <AlertTriangle size={16} />
            STATUS: {weaponsFree ? 'WEAPONS FREE' : 'WEAPONS TIGHT'}
          </div>
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-tactical-green" />
            PHASE: {phase}
          </div>
          <div className="text-tactical-blue">
            SCORE: {score}
          </div>
        </div>

        <div>
          {phase === GamePhase.ACTIVE && (
            <button onClick={handleEndGame} className="bg-red-900/50 border border-red-700 text-red-200 px-3 py-1 text-xs rounded hover:bg-red-800 transition-colors">
              END EXERCISE
            </button>
          )}
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 grid grid-cols-12 grid-rows-1 gap-1 p-2 h-0">

        {/* Left: Tracks & Status */}
        <div className="col-span-2 flex flex-col gap-2">
          <div className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase border-b border-gray-700 pb-1">Track List</h3>
            <div className="space-y-1">
              {tracks.filter(t => t.type !== TrackType.MISSILE || t.identity === TrackIdentity.HOSTILE).map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTrackId(t.id)}
                  className={`text-xs font-mono cursor-pointer p-1 rounded hover:bg-gray-800 ${t.id === selectedTrackId ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
                >
                  <div className="flex justify-between">
                    <span className="truncate max-w-[60%]">{t.callsign}</span>
                    <span className={t.identity === TrackIdentity.HOSTILE ? 'text-red-500' : t.identity === TrackIdentity.FRIEND ? 'text-blue-500' : 'text-amber-500'}>
                      {t.identity.charAt(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="h-1/3 bg-gray-900 border border-gray-700 rounded p-2 font-mono text-xs">
            <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase border-b border-gray-700 pb-1">Ownship Status</h3>
            <div className="grid grid-cols-2 gap-y-1 text-gray-400">
              <span>Course:</span> <span className="text-green-500 text-right">{OWNSHIP_VECTOR.heading}°</span>
              <span>Speed:</span> <span className="text-green-500 text-right">{OWNSHIP_VECTOR.speed} KTS</span>
              <span>VLS A:</span> <span className="text-green-500 text-right">32/32</span>
              <span>SPY-1:</span> <span className="text-green-500 text-right">RADIATING</span>
            </div>
          </div>
        </div>

        {/* Center: Radar */}
        <div className="col-span-7 relative bg-black border border-gray-800 rounded overflow-hidden">
          {phase === GamePhase.BRIEFING ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-20 backdrop-blur-sm">
              <div className="max-w-md text-center p-8">
                <h2 className="text-2xl font-bold text-tactical-green mb-4 tracking-widest">TACTICAL SIMULATION</h2>
                <p className="text-gray-400 mb-8">
                  You are the Tactical Action Officer aboard USS Vella Gulf.
                  <br /><br />
                  Defend the formation. Identify unknown contacts.
                </p>
                <button
                  onClick={startScenario}
                  disabled={loading}
                  className="bg-tactical-green hover:bg-green-600 text-black font-bold py-3 px-8 rounded flex items-center justify-center gap-2 w-full transition-all disabled:opacity-50"
                >
                  {loading ? 'GENERATING SCENARIO...' : <><Play size={20} /> START SCENARIO</>}
                </button>
              </div>
            </div>
          ) : null}

          {phase === GamePhase.DEBRIEFING ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 z-20 backdrop-blur-sm">
              <div className="max-w-lg text-left p-8 border border-gray-600 bg-gray-900 rounded shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-2">AFTER ACTION REPORT</h2>
                <div className="h-px w-full bg-gray-600 mb-4"></div>
                <div className="space-y-4 font-mono">
                  <div>
                    <span className="text-gray-500 block text-xs uppercase">Final Score</span>
                    <span className={`text-4xl font-bold ${score > 0 ? 'text-green-500' : 'text-red-500'}`}>{score}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs uppercase">Evaluator Comments</span>
                    <p className="text-gray-300 text-sm leading-relaxed mt-1">
                      {debriefText || "Analyzing telemetry..."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-8 w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded font-bold border border-gray-500 transition-colors"
                >
                  RESET SYSTEM
                </button>
              </div>
            </div>
          ) : null}

          <RadarDisplay
            tracks={tracks.filter(t => {
              // Calculate distance to ownship (0,0)
              const dist = Math.sqrt(t.position.x * t.position.x + t.position.y * t.position.y);

              // Determine Max Detection Range
              // Check if Hawkeye is alive
              const hawkeye = tracks.find(tr => tr.id === 'own-hawkeye-1');
              const hawkeyeActive = hawkeye && hawkeye.engagementStatus !== EngagementStatus.DESTROYED;

              const maxRange = hawkeyeActive ? 300 : 200;

              return dist <= maxRange;
            })}
            selectedTrackId={selectedTrackId}
            onSelectTrack={setSelectedTrackId}
            ownShipHeading={OWNSHIP_VECTOR.heading}
            currentRange={radarRange}
            onRangeChange={setRadarRange}
          />

          {/* Scenario overlay text */}
          {scenarioDesc && phase === GamePhase.ACTIVE && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-1 rounded text-xs text-gray-400 border border-gray-800 pointer-events-none">
              SCENARIO: {scenarioDesc}
            </div>
          )}
        </div>

        {/* Right: Controls & Logs */}
        <div className="col-span-3 flex flex-col gap-2 h-full min-h-0">
          <div className="h-auto shrink-0">
            <ControlPanel
              selectedTrack={tracks.find(t => t.id === selectedTrackId) || null}
              onIdentify={handleIdentify}
              onEngage={handleEngage}
              onWarning={handleWarning}
              gamePhase={phase}
              weaponsFree={weaponsFree}
              toggleWeaponsFree={() => {
                const newState = !weaponsFree;
                setWeaponsFree(newState);
                addLog("TAO", newState ? "WEAPONS FREE AUTHORIZED" : "WEAPONS TIGHT", 'high');
              }}
            />
          </div>
          <div className="flex-1 min-h-0">
            <CommsLog messages={logs} />
          </div>
          <div className="shrink-0">
            <button
              onClick={() => {
                const newState = !weaponsFree;
                setWeaponsFree(newState);
                addLog("TAO", newState ? "WEAPONS FREE AUTHORIZED" : "WEAPONS TIGHT", 'high');
              }}
              className={`w-full py-2 px-4 rounded font-bold font-mono text-sm border transition-colors ${weaponsFree ? 'bg-red-900/50 text-red-200 border-red-800' : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700'}`}
            >
              TOGGLE ROE: {weaponsFree ? 'FREE' : 'TIGHT'}
            </button>
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;