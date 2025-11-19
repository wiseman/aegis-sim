import React from 'react';
import { Track, TrackIdentity, EngagementStatus } from '../types';
import { ShieldAlert, Crosshair, Radio, AlertTriangle } from 'lucide-react';

interface ControlPanelProps {
  selectedTrack: Track | null;
  onIdentify: (id: string, identity: TrackIdentity) => void;
  onEngage: (id: string) => void;
  onWarning: (id: string) => void;
  gamePhase: string;
  weaponsFree: boolean;
  toggleWeaponsFree: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  selectedTrack,
  onIdentify,
  onEngage,
  onWarning,
  gamePhase,
  weaponsFree,
  toggleWeaponsFree
}) => {

  if (!selectedTrack) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600 font-mono border border-gray-800 bg-gray-900 rounded-lg">
        NO TRACK SELECTED
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 bg-gray-900 p-4 rounded-lg border border-gray-700 font-mono">
      {/* Track Info Header */}
      <div className="border-b border-gray-700 pb-2">
        <h2 className="text-xl text-white font-bold flex items-center gap-2">
          <Crosshair size={20} />
          TRACK: {selectedTrack.callsign}
        </h2>
        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
          <div className="text-gray-400">BRG: <span className="text-white">{Math.round((Math.atan2(selectedTrack.position.x, selectedTrack.position.y) * 180 / Math.PI + 360) % 360).toString().padStart(3, '0')}</span></div>
          <div className="text-gray-400">RNG: <span className="text-white">{Math.round(Math.sqrt(selectedTrack.position.x ** 2 + selectedTrack.position.y ** 2))} NM</span></div>
          <div className="text-gray-400">ALT: <span className="text-white">{selectedTrack.altitude} FT</span></div>
          <div className="text-gray-400">SPD: <span className="text-white">{selectedTrack.vector.speed} KTS</span></div>
          <div className="text-gray-400">ID: <span className={`${selectedTrack.identity === 'HOSTILE' ? 'text-red-500' : selectedTrack.identity === 'FRIEND' ? 'text-blue-500' : 'text-amber-500'}`}>{selectedTrack.identity}</span></div>
          <div className="text-gray-400">STS: <span className="text-white">{selectedTrack.engagementStatus}</span></div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <div className="text-xs text-gray-500 uppercase font-bold">Identification</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onIdentify(selectedTrack.id, TrackIdentity.FRIEND)}
            className="bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 border border-blue-800 py-2 px-4 rounded text-sm transition-colors"
          >
            MARK FRIEND
          </button>
          <button
            onClick={() => onIdentify(selectedTrack.id, TrackIdentity.HOSTILE)}
            className="bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800 py-2 px-4 rounded text-sm transition-colors"
          >
            MARK HOSTILE
          </button>
          <button
            onClick={() => onIdentify(selectedTrack.id, TrackIdentity.NEUTRAL)}
            className="bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-800 py-2 px-4 rounded text-sm transition-colors"
          >
            MARK NEUTRAL
          </button>
          <button
            onClick={() => onIdentify(selectedTrack.id, TrackIdentity.UNKNOWN)}
            className="bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 border border-yellow-800 py-2 px-4 rounded text-sm transition-colors"
          >
            RESET ID
          </button>
        </div>

        <div className="text-xs text-gray-500 uppercase font-bold mt-2">Intervention</div>
        <button
          onClick={() => onWarning(selectedTrack.id)}
          className="flex items-center justify-center gap-2 bg-amber-900/20 hover:bg-amber-900/40 text-amber-500 border border-amber-700 py-3 rounded transition-colors"
        >
          <Radio size={16} />
          ISSUE QUERY / WARNING
        </button>

        <div className="mt-auto">
          <div className="text-xs text-gray-500 uppercase font-bold mb-2">Weapons Release</div>
          {weaponsFree ? (
            <button
              onClick={() => onEngage(selectedTrack.id)}
              disabled={selectedTrack.engagementStatus !== EngagementStatus.NONE && selectedTrack.engagementStatus !== EngagementStatus.TRACKING}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded border-2 border-red-800 shadow-[0_0_15px_rgba(239,68,68,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ShieldAlert size={20} />
              ENGAGE WITH SM-2
            </button>
          ) : (
            <div className="w-full py-4 bg-gray-800 border border-gray-600 text-gray-500 text-center rounded flex items-center justify-center gap-2">
              <AlertTriangle size={16} /> WEAPONS TIGHT
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ControlPanel;