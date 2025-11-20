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

export const calculateProportionalNavigationVector = (
    missilePos: Position,
    missileVector: Vector,
    targetPos: Position,
    targetVector: Vector,
    navConstant: number = 3 // Standard N value is usually 3-5
): Vector => {
    // 1. Current LOS Angle
    const losAngle = calculateBearing(missilePos, targetPos);

    // 2. Convert everything to radians for math
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    const losRad = (90 - losAngle) * toRad;
    const mHeadingRad = (90 - missileVector.heading) * toRad;
    const tHeadingRad = (90 - targetVector.heading) * toRad;

    // 3. Velocities
    const mVx = Math.cos(mHeadingRad) * missileVector.speed;
    const mVy = Math.sin(mHeadingRad) * missileVector.speed;

    const tVx = Math.cos(tHeadingRad) * targetVector.speed;
    const tVy = Math.sin(tHeadingRad) * targetVector.speed;

    // 4. Relative Velocity
    const rVx = tVx - mVx;
    const rVy = tVy - mVy;

    // 5. Range and Closing Velocity
    const dx = targetPos.x - missilePos.x;
    const dy = targetPos.y - missilePos.y;
    const range = Math.sqrt(dx * dx + dy * dy);

    // Closing velocity (V_c) is the projection of relative velocity onto LOS
    // V_c = - (r . LOS) / |r|
    // But we can also just use the rotation rate formula directly.

    // 6. LOS Rotation Rate (Omega)
    // Omega = (r x v) / r^2  (2D cross product)
    // Omega = (x * vy - y * vx) / r^2
    const crossProduct = (dx * rVy - dy * rVx);
    const omega = crossProduct / (range * range); // rad/s (if units were consistent seconds)

    // However, our speed is in knots (nm/hr) and positions in nm.
    // So omega is in rad/hr.

    // 7. Lateral Acceleration Command (a_c)
    // a_c = N * V_c * Omega
    // But for simple heading update in a kinematic simulation:
    // Rate of change of heading = N * Omega

    const headingRate = navConstant * omega; // rad/hr change

    // Apply this rate to the current heading for the duration of the tick?
    // Actually, for a simple discrete step, we can just say:
    // New Heading = Old Heading + N * (Change in LOS)
    // But we don't have "Change in LOS" easily without storing state.

    // Alternative: Pure PN implementation often defines the acceleration vector.
    // For a kinematic model where we just set heading:
    // We want to lead the target.

    // Let's try a simpler "Lead Pursuit" calculation if full PN is too complex for state-less update.
    // Calculate the collision point assuming constant velocities.

    // Time to intercept approx = Distance / Closing Speed
    // This is an iterative solution usually.

    // Let's stick to the Rate based approach but approximate "Change in LOS" 
    // We can't do true rate-based PN without knowing the time delta or previous LOS.
    // BUT, we can calculate the "Zero Effort Miss" or just the ideal lead angle.

    // Let's use the "Collision Triangle" approach (Constant Bearing).
    // We want to find a missile heading such that the LOS angle remains constant.
    // V_m * sin(Lead Angle) = V_t * sin(Aspect Angle)

    const aspectAngle = tHeadingRad - losRad; // Angle between Target Vel and LOS
    const vT_perp = targetVector.speed * Math.sin(aspectAngle); // Target velocity perpendicular to LOS

    // We need Missile Velocity perp to LOS to match Target Velocity perp to LOS
    // V_m_perp = V_m * sin(Lead Angle)
    // V_m * sin(Lead Angle) = V_t_perp
    // sin(Lead Angle) = V_t_perp / V_m

    const sinLead = vT_perp / missileVector.speed;

    let newHeading = missileVector.heading;

    if (Math.abs(sinLead) <= 1) {
        const leadAngle = Math.asin(sinLead); // radians
        // The required missile heading is LOS + Lead Angle
        // Note: We need to be careful with signs.
        // If V_t_perp is positive (target moving "left" relative to LOS), we need to aim "left".

        // Re-calculate in absolute terms
        const idealHeadingRad = losRad + leadAngle;
        const idealHeadingDeg = (90 - idealHeadingRad * toDeg + 360) % 360;

        newHeading = idealHeadingDeg;
    } else {
        // Target too fast, can't intercept? Just do pure pursuit.
        newHeading = losAngle;
    }

    return { heading: newHeading, speed: missileVector.speed };
};
