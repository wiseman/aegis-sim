import { Position, Vector } from '../types';

export const calculateDistance = (p1: Position, p2: Position): number => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
};

export const calculateBearing = (from: Position, to: Position): number => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angleRad = Math.atan2(dy, dx);
    return (90 - angleRad * (180 / Math.PI) + 360) % 360;
};

export const calculateVectorToTarget = (sourcePos: Position, targetPos: Position, speed: number): Vector => {
    const heading = calculateBearing(sourcePos, targetPos);
    return { heading, speed };
};

export const calculateEgressVector = (sourcePos: Position, threatPos: Position, speed: number): Vector => {
    const bearingToThreat = calculateBearing(sourcePos, threatPos);
    // Egress is opposite to bearing to threat (180 degrees away)
    const egressHeading = (bearingToThreat + 180) % 360;
    return { heading: egressHeading, speed };
};

export const calculateBullseye = (sourcePos: Position, bullseyePos: Position) => {
    const dx = sourcePos.x - bullseyePos.x;
    const dy = sourcePos.y - bullseyePos.y;
    const range = Math.sqrt(dx * dx + dy * dy);
    const bearingRad = Math.atan2(dy, dx);
    const bearingDeg = (90 - (bearingRad * (180 / Math.PI)) + 360) % 360;

    return {
        bearing: Math.round(bearingDeg / 5) * 5,
        range: Math.round(range)
    };
};

export const updatePosition = (
    currentPos: Position,
    trackVector: Vector,
    ownshipVector: Vector,
    hoursPerTick: number
): Position => {
    // Decompose Ownship Vector
    const ownRads = (90 - ownshipVector.heading) * (Math.PI / 180);
    const ownVx = Math.cos(ownRads) * ownshipVector.speed;
    const ownVy = Math.sin(ownRads) * ownshipVector.speed;

    // Decompose Track Vector
    const trackRads = (90 - trackVector.heading) * (Math.PI / 180);
    const trackVx = Math.cos(trackRads) * trackVector.speed;
    const trackVy = Math.sin(trackRads) * trackVector.speed;

    // Relative Velocity
    const relVx = trackVx - ownVx;
    const relVy = trackVy - ownVy;

    // Apply Movement
    const dx = relVx * hoursPerTick;
    const dy = relVy * hoursPerTick;

    return {
        x: currentPos.x + dx,
        y: currentPos.y + dy
    };
};
