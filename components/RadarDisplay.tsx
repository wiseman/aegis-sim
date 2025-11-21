import React from 'react';
import { Track, TrackIdentity, Position, TrackType, EngagementStatus } from '../types';


interface RadarDisplayProps {
  tracks: Track[];
  selectedTrackId: string | null;
  onSelectTrack: (id: string) => void;
  ownShipHeading: number;
  currentRange: number;
  onRangeChange: (range: number) => void;
}

const RadarDisplay: React.FC<RadarDisplayProps> = ({
  tracks,
  selectedTrackId,
  onSelectTrack,
  ownShipHeading,
  currentRange,
  onRangeChange
}) => {
  const size = 600;
  const center = size / 2;
  const scale = (size / 2) / currentRange; // pixels per NM

  const worldToScreen = (pos: Position) => {
    return {
      x: center + (pos.x * scale),
      y: center - (pos.y * scale) // Invert Y for screen coords
    };
  };

  // Helper to get color based on ID
  const getTrackColor = (identity: TrackIdentity) => {
    switch (identity) {
      case TrackIdentity.HOSTILE: return 'text-tactical-red stroke-tactical-red fill-tactical-red';
      case TrackIdentity.FRIEND: return 'text-tactical-blue stroke-tactical-blue fill-tactical-blue';
      case TrackIdentity.UNKNOWN:
      case TrackIdentity.PENDING: return 'text-tactical-amber stroke-tactical-amber fill-tactical-amber';
      case TrackIdentity.NEUTRAL: return 'text-tactical-green stroke-tactical-green fill-tactical-green';
      default: return 'text-white stroke-white';
    }
  };

  // Helper to render symbol based on type and identity
  const renderSymbol = (track: Track, x: number, y: number) => {
    if (!track || !track.vector) return null; // Safety check

    const colorClass = getTrackColor(track.identity);
    const isSelected = track.id === selectedTrackId;
    const isFormation = track.type === TrackType.SURFACE && track.identity === TrackIdentity.FRIEND;

    let shape;

    if (track.type === TrackType.AIR) {
      if (track.identity === TrackIdentity.HOSTILE) {
        // Diamond
        shape = <polygon points={`${x},${y - 8} ${x + 8},${y} ${x},${y + 8} ${x - 8},${y}`} className={`${colorClass} fill-transparent stroke-2`} />;
      } else if (track.identity === TrackIdentity.FRIEND) {
        // Circle
        shape = <circle cx={x} cy={y} r={8} className={`${colorClass} fill-transparent stroke-2`} />;
      } else {
        // Square (Unknown/Neutral) half
        shape = <rect x={x - 7} y={y - 7} width={14} height={14} className={`${colorClass} fill-transparent stroke-2`} />;
      }
    } else if (track.type === TrackType.MISSILE) {
      shape = <path d={`M ${x} ${y} L ${x + 4} ${y + 4} M ${x} ${y} L ${x - 4} ${y + 4} M ${x} ${y} L ${x} ${y - 6}`} className="stroke-red-500 stroke-2" />;
    } else {
      // Surface
      // Mil-std style surface track is circle with flat bottom
      shape = <path d={`M ${x - 8} ${y} A 8 8 0 1 1 ${x + 8} ${y} L ${x - 8} ${y} Z`} className={`${colorClass} fill-transparent stroke-2`} />;
    }

    // Velocity Vector (Leader)
    const speed = track.vector.speed || 0;
    const heading = track.vector.heading || 0;

    const vectorLength = Math.min((speed / 100) * 10, 60); // Cap max length
    const rads = (heading - 90) * (Math.PI / 180);
    const endX = x + Math.cos(rads) * vectorLength;
    const endY = y + Math.sin(rads) * vectorLength;

    return (
      <g
        key={track.id}
        onClick={() => onSelectTrack(track.id)}
        className={`cursor-pointer transition-opacity duration-500 ${track.engagementStatus === EngagementStatus.DESTROYED ? 'opacity-0' : 'opacity-100'}`}
      >
        {/* Leader line */}
        {!Number.isNaN(endX) && !Number.isNaN(endY) && (
          <line x1={x} y1={y} x2={endX} y2={endY} className={`${colorClass} stroke-1 opacity-70`} />
        )}

        {/* Symbol */}
        {shape}

        {/* Selection Indicator */}
        {isSelected && (
          <circle cx={x} cy={y} r={16} className="stroke-white stroke-1 fill-transparent animate-pulse" strokeDasharray="4 2" />
        )}

        {/* Label */}
        <text x={x + 12} y={y} className={`text-xs font-mono fill-current ${colorClass.split(' ')[0]} select-none`}>
          {track.callsign ? track.callsign.replace(/\s/g, '').substring(0, 7) : "UNK"}
        </text>
        <text x={x + 12} y={y + 10} className={`text-[10px] font-mono fill-current ${colorClass.split(' ')[0]} select-none opacity-70`}>
          {track.altitude > 0 ? Math.round(track.altitude / 100) + 'FL' : 'SURF'}
        </text>
      </g>
    );
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-radar-black overflow-hidden shadow-inner shadow-black">
      {/* Grid / Overlay */}
      <svg width={size} height={size} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 overflow-visible">

        {/* Range Rings */}
        <circle cx={center} cy={center} r={scale * (currentRange * 0.25)} className="stroke-gray-800 fill-none stroke-1" />
        <circle cx={center} cy={center} r={scale * (currentRange * 0.50)} className="stroke-gray-800 fill-none stroke-1" />
        <circle cx={center} cy={center} r={scale * (currentRange * 0.75)} className="stroke-gray-800 fill-none stroke-1" />
        <circle cx={center} cy={center} r={scale * currentRange} className="stroke-gray-700 fill-none stroke-2" />

        {/* Crosshairs */}
        <line x1={center} y1={-100} x2={center} y2={size + 100} className="stroke-gray-800 stroke-1" />
        <line x1={-100} y1={center} x2={size + 100} y2={center} className="stroke-gray-800 stroke-1" />

        {/* Ownship - Center */}
        <g transform={`translate(${center}, ${center})`}>
          {/* Ownship Symbol: Blue Circle with Cross */}
          <circle cx={0} cy={0} r={6} className="fill-tactical-blue stroke-none" />
          <line x1={-8} y1={0} x2={8} y2={0} className="stroke-black stroke-2" />
          <line x1={0} y1={-8} x2={0} y2={8} className="stroke-black stroke-2" />
          {/* Heading Line */}
          <line x1={0} y1={0} x2={0} y2={-30} className="stroke-tactical-blue stroke-2" />
          <text x={8} y={-8} className="fill-tactical-blue text-[10px] font-mono">OWN</text>
        </g>

        {/* Tracks */}
        {tracks.map(t => {
          const screenPos = worldToScreen(t.position);
          if (Number.isNaN(screenPos.x) || Number.isNaN(screenPos.y)) return null;
          return renderSymbol(t, screenPos.x, screenPos.y);
        })}

      </svg>

      {/* Sweep Animation Overlay */}
      <div className="absolute inset-0 pointer-events-none rounded-full overflow-hidden">
        <div className="w-full h-full bg-[conic-gradient(transparent_270deg,rgba(16,185,129,0.1)_360deg)] animate-radar-sweep rounded-full border border-transparent"></div>
      </div>

      {/* Corner Labels */}
      <div className="absolute top-2 left-2 text-tactical-green font-mono text-xs opacity-60">
        RNG: {currentRange}NM <br />
        MODE: RELATIVE MOT <br />
        EMCON: ALPHA
      </div>

      {/* Range Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        {[300, 200, 100].map(range => (
          <button
            key={range}
            onClick={() => onRangeChange(range)}
            className={`px-2 py-1 text-xs font-mono border ${currentRange === range ? 'bg-tactical-green text-black border-tactical-green' : 'bg-black text-tactical-green border-tactical-green hover:bg-gray-900'}`}
          >
            {range} NM
          </button>
        ))}
      </div>
    </div>
  );
};

export default RadarDisplay;