import React, { useState, useMemo } from 'react';
import { Field } from '../types';
import { Compass, Eye, Ruler, Info, Check, Shield } from 'lucide-react';

export interface SoccerFieldGraphicProps {
  field: Field;
  interactive?: boolean;
  showDimensions?: boolean;
  activeMarking?: string | null;
  onSelectMarking?: (marking: string | null) => void;
  styleMode?: 'realistic' | 'blueprint';
  className?: string;
}

// Helper to determine default dimensions if not specified
export function getFieldDimensions(field: Field): {
  lengthYards: number;
  widthYards: number;
  lengthMeters: number;
  widthMeters: number;
  centerCircleRadius: number;
  penaltyDepth: number;
  penaltyWidth: number;
  goalAreaDepth: number;
  goalAreaWidth: number;
  penaltySpotDist: number;
  penaltyArcRadius: number;
  goalWidth: number;
  goalDepth: number;
  goalHeightFeet: number;
  hasBuildOutLine: boolean;
  buildOutDist: number; // Distance from goal line
  isFutsal: boolean;
} {
  const sizeLower = (field.size || '').toLowerCase();
  let length = field.lengthYards;
  let width = field.widthYards;

  const isFutsal = sizeLower.includes('5v5') || sizeLower.includes('futsal') || field.surfaceType === 'Indoor / Futsal';
  const is4v4 = sizeLower.includes('4v4') || sizeLower.includes('micro');
  const is7v7 = sizeLower.includes('7v7') || sizeLower.includes('small');
  const is9v9 = sizeLower.includes('9v9') || sizeLower.includes('intermediate');
  const is11v11 = sizeLower.includes('11v11') || sizeLower.includes('full') || (!isFutsal && !is4v4 && !is7v7 && !is9v9);

  // Defaults if not provided
  if (!length || !width) {
    if (isFutsal) {
      length = length || 42;
      width = width || 25;
    } else if (is4v4) {
      length = length || 30;
      width = width || 20;
    } else if (is7v7) {
      length = length || 60;
      width = width || 40;
    } else if (is9v9) {
      length = length || 75;
      width = width || 50;
    } else {
      // 11v11 FIFA standard default
      length = length || 115;
      width = width || 75;
    }
  }

  // Calculate markings dimensions scaled proportionately
  let centerCircleRadius = 10;
  let penaltyDepth = 18;
  let penaltyWidth = 44;
  let goalAreaDepth = 6;
  let goalAreaWidth = 20;
  let penaltySpotDist = 12;
  let penaltyArcRadius = 10;
  let goalWidth = 8; // 24 feet = 8 yards
  let goalDepth = 2.8;
  let goalHeightFeet = 8;
  let hasBuildOutLine = false;
  let buildOutDist = 0;

  if (isFutsal) {
    centerCircleRadius = 3.3; // 3 meters
    penaltyDepth = 6.6; // 6 meters D
    penaltyWidth = 14;
    goalAreaDepth = 0; // Futsal uses D
    goalAreaWidth = 0;
    penaltySpotDist = 6.6; // 6m
    penaltyArcRadius = 0;
    goalWidth = 3.3; // 3m (10ft)
    goalDepth = 1.5;
    goalHeightFeet = 6.5;
  } else if (is4v4) {
    centerCircleRadius = 4;
    penaltyDepth = 0; // 4v4 usually has no penalty area or small crease
    penaltyWidth = 0;
    goalAreaDepth = 0;
    goalAreaWidth = 0;
    penaltySpotDist = 0;
    penaltyArcRadius = 0;
    goalWidth = 2.0; // 6ft
    goalDepth = 1.2;
    goalHeightFeet = 4;
  } else if (is7v7) {
    centerCircleRadius = 7;
    penaltyDepth = 12;
    penaltyWidth = 24;
    goalAreaDepth = 4;
    goalAreaWidth = 12;
    penaltySpotDist = 8;
    penaltyArcRadius = 7;
    goalWidth = 6.16; // 18.5 feet
    goalDepth = 2.2;
    goalHeightFeet = 6.5;
    hasBuildOutLine = true;
    // Build out line is halfway between penalty line and midfield line
    buildOutDist = penaltyDepth + (length / 2 - penaltyDepth) / 2;
  } else if (is9v9) {
    centerCircleRadius = 8;
    penaltyDepth = 14;
    penaltyWidth = 36;
    goalAreaDepth = 5;
    goalAreaWidth = 16;
    penaltySpotDist = 10;
    penaltyArcRadius = 8;
    goalWidth = 7; // 21 feet
    goalDepth = 2.5;
    goalHeightFeet = 7;
  }

  // Check markings array override for build-out line
  if (field.markings && field.markings.some((m) => m.toLowerCase().includes('build-out') || m.toLowerCase().includes('retreat'))) {
    hasBuildOutLine = true;
    if (buildOutDist === 0) {
      buildOutDist = penaltyDepth + (length / 2 - penaltyDepth) / 2;
    }
  }

  return {
    lengthYards: length,
    widthYards: width,
    lengthMeters: Math.round(length * 0.9144 * 10) / 10,
    widthMeters: Math.round(width * 0.9144 * 10) / 10,
    centerCircleRadius: Math.min(centerCircleRadius, width * 0.22),
    penaltyDepth: Math.min(penaltyDepth, length * 0.25),
    penaltyWidth: Math.min(penaltyWidth, width * 0.8),
    goalAreaDepth: Math.min(goalAreaDepth, penaltyDepth * 0.5),
    goalAreaWidth: Math.min(goalAreaWidth, penaltyWidth * 0.6),
    penaltySpotDist: Math.min(penaltySpotDist, penaltyDepth * 0.75),
    penaltyArcRadius: Math.min(penaltyArcRadius, width * 0.22),
    goalWidth: Math.min(goalWidth, width * 0.4),
    goalDepth,
    goalHeightFeet,
    hasBuildOutLine,
    buildOutDist,
    isFutsal,
  };
}

export const SoccerFieldGraphic: React.FC<SoccerFieldGraphicProps> = ({
  field,
  interactive = true,
  showDimensions = true,
  activeMarking = null,
  onSelectMarking,
  styleMode = 'realistic',
  className = '',
}) => {
  const [hoveredMarking, setHoveredMarking] = useState<string | null>(null);

  const dim = useMemo(() => getFieldDimensions(field), [field]);
  const L = dim.lengthYards;
  const W = dim.widthYards;

  // Margin spacing around pitch for dimension callouts, goals, and technical areas
  const marginX = Math.max(7, L * 0.09); // Behind goal lines
  const marginY = Math.max(6.5, W * 0.12); // Sidelines

  const svgWidth = L + marginX * 2;
  const svgHeight = W + marginY * 2;

  // Field coordinates
  const fx = marginX;
  const fy = marginY;
  const cx = fx + L / 2;
  const cy = fy + W / 2;

  // Effective highlighted marking
  const highlighted = activeMarking || hoveredMarking;

  const isMarkingActive = (name: string) => {
    if (!highlighted) return false;
    const h = highlighted.toLowerCase();
    const n = name.toLowerCase();
    return h.includes(n) || n.includes(h);
  };

  const handleMarkingClick = (markingName: string) => {
    if (!interactive) return;
    if (onSelectMarking) {
      onSelectMarking(activeMarking === markingName ? null : markingName);
    }
  };

  // Surface rendering theme
  const isTurf = field.surfaceType === 'Artificial Turf';
  const isFutsal = dim.isFutsal;
  const isHybrid = field.surfaceType === 'Hybrid';
  const isBlueprint = styleMode === 'blueprint';

  // Stripe count for mowed grass
  const stripeCount = 10;
  const stripeWidth = L / stripeCount;

  // Color scheme
  const colors = useMemo(() => {
    if (isBlueprint) {
      return {
        bg: '#0f172a', // slate-900
        pitchBg: '#1e293b', // slate-800
        stripe1: '#1e293b',
        stripe2: '#162234',
        lines: '#38bdf8', // sky-400
        lineShadow: '#0284c7',
        linesActive: '#f59e0b', // amber-500
        dimensions: '#94a3b8',
        goals: '#e2e8f0',
        cornerFlag: '#f43f5e',
        technicalArea: 'rgba(56, 189, 248, 0.15)',
        technicalBorder: '#38bdf8',
        buildOut: '#fbbf24',
      };
    }
    if (isFutsal) {
      return {
        bg: '#0f172a',
        pitchBg: '#1565c0', // Futsal blue sport court
        stripe1: '#1565c0',
        stripe2: '#1976d2',
        lines: '#ffffff',
        lineShadow: 'rgba(0, 0, 0, 0.25)',
        linesActive: '#fbbf24',
        dimensions: '#cbd5e1',
        goals: '#ffffff',
        cornerFlag: '#f59e0b',
        technicalArea: 'rgba(255, 255, 255, 0.15)',
        technicalBorder: '#ffffff',
        buildOut: '#fbbf24',
      };
    }
    if (isTurf) {
      return {
        bg: '#092514',
        pitchBg: '#1b5e20', // deep turf green
        stripe1: '#1e6624',
        stripe2: '#17571c',
        lines: '#ffffff',
        lineShadow: 'rgba(0, 0, 0, 0.35)',
        linesActive: '#fbbf24',
        dimensions: '#a7f3d0',
        goals: '#ffffff',
        cornerFlag: '#ef4444',
        technicalArea: 'rgba(255, 255, 255, 0.15)',
        technicalBorder: '#e2e8f0',
        buildOut: '#fde047',
      };
    }
    if (isHybrid) {
      return {
        bg: '#0c2615',
        pitchBg: '#23692e',
        stripe1: '#267332',
        stripe2: '#1e5f27',
        lines: '#ffffff',
        lineShadow: 'rgba(0, 0, 0, 0.35)',
        linesActive: '#fbbf24',
        dimensions: '#bbf7d0',
        goals: '#ffffff',
        cornerFlag: '#f43f5e',
        technicalArea: 'rgba(255, 255, 255, 0.18)',
        technicalBorder: '#ffffff',
        buildOut: '#fde047',
      };
    }
    // Natural grass
    return {
      bg: '#092211',
      pitchBg: '#2e7d32',
      stripe1: '#2f8134',
      stripe2: '#27702b',
      lines: '#ffffff',
      lineShadow: 'rgba(0, 0, 0, 0.35)',
      linesActive: '#f59e0b',
      dimensions: '#dcfce7',
      goals: '#ffffff',
      cornerFlag: '#ef4444',
      technicalArea: 'rgba(255, 255, 255, 0.15)',
      technicalBorder: '#ffffff',
      buildOut: '#fde047',
    };
  }, [isBlueprint, isFutsal, isTurf, isHybrid]);

  // Corner arc radius
  const cornerR = Math.min(1.0, W * 0.04);

  // Technical Areas positions (on bottom touchline margin)
  const techWidth = Math.min(12, L * 0.16);
  const techDepth = Math.min(3.5, marginY * 0.7);
  const techY = fy + W + 1.2;
  const homeTechX = cx - techWidth - 3;
  const awayTechX = cx + 3;

  // Penalty D arc calculation (outside penalty area)
  // Distance from penalty spot to penalty line is: penaltyDepth - penaltySpotDist
  // Angle where arc intersects penalty line: cos(theta) = (penaltyDepth - penaltySpotDist) / arcRadius
  const penLineDist = dim.penaltyDepth - dim.penaltySpotDist;
  const canDrawD = dim.penaltyArcRadius > penLineDist && penLineDist > 0;
  let dAngle = 0;
  let dOffsetY = 0;
  if (canDrawD) {
    const cosVal = penLineDist / dim.penaltyArcRadius;
    if (cosVal <= 1) {
      dAngle = Math.acos(cosVal);
      dOffsetY = dim.penaltyArcRadius * Math.sin(dAngle);
    }
  }

  return (
    <div className={`relative w-full overflow-hidden select-none ${className}`}>
      {/* SVG Pitch Canvas */}
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto max-h-[480px] drop-shadow-md rounded-xl transition-all duration-300"
        style={{ backgroundColor: colors.bg }}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Visual diagram of ${field.name} (${dim.lengthYards}x${dim.widthYards} yards)`}
      >
        <defs>
          {/* Subtle grass/turf pattern or blueprint grid */}
          {isBlueprint ? (
            <pattern id="bp-grid" width="4" height="4" patternUnits="userSpaceOnUse">
              <path d="M 4 0 L 0 0 0 4" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="0.2" />
            </pattern>
          ) : (
            <pattern id="turf-grain" width="2" height="2" patternUnits="userSpaceOnUse">
              <rect width="2" height="2" fill="none" />
              <circle cx="1" cy="1" r="0.15" fill="rgba(255,255,255,0.08)" />
            </pattern>
          )}

          {/* Goal Net Pattern */}
          <pattern id="goal-net" width="0.7" height="0.7" patternUnits="userSpaceOnUse">
            <path
              d="M 0.7 0 L 0 0 0 0.7"
              fill="none"
              stroke={isBlueprint ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.45)'}
              strokeWidth="0.15"
            />
          </pattern>

          {/* Drop shadow filter for crisp pitch border */}
          <filter id="pitch-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="0.5" stdDeviation="0.8" floodOpacity="0.4" />
          </filter>

          {/* Glowing filter for highlighted markings */}
          <filter id="glow-highlight" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#fbbf24" floodOpacity="0.9" />
          </filter>
        </defs>

        {/* Pitch Playing Field Background Rect */}
        <rect
          x={fx}
          y={fy}
          width={L}
          height={W}
          fill={colors.pitchBg}
          filter="url(#pitch-shadow)"
          rx={0.6}
        />

        {/* Alternating lawn mow stripes (for grass / turf) */}
        {!isBlueprint &&
          Array.from({ length: stripeCount }).map((_, idx) => (
            <rect
              key={idx}
              x={fx + idx * stripeWidth}
              y={fy}
              width={stripeWidth}
              height={W}
              fill={idx % 2 === 0 ? colors.stripe1 : colors.stripe2}
              opacity={0.9}
            />
          ))}

        {/* Texture overlay */}
        <rect
          x={fx}
          y={fy}
          width={L}
          height={W}
          fill={isBlueprint ? 'url(#bp-grid)' : 'url(#turf-grain)'}
          opacity={isBlueprint ? 1 : 0.6}
        />

        {/* ================= PITCH MARKINGS ================= */}

        {/* 1. Touchlines & Goal Lines (Outer Boundary) */}
        <g
          className="cursor-pointer transition-colors"
          onClick={() => handleMarkingClick('Touchlines & Goal Lines')}
          onMouseEnter={() => setHoveredMarking('Touchlines & Goal Lines')}
          onMouseLeave={() => setHoveredMarking(null)}
        >
          <rect
            x={fx}
            y={fy}
            width={L}
            height={W}
            fill="none"
            stroke={isMarkingActive('Touchlines') || isMarkingActive('Goal Lines') ? colors.linesActive : colors.lines}
            strokeWidth={isMarkingActive('Touchlines') ? '0.7' : '0.4'}
            filter={isMarkingActive('Touchlines') ? 'url(#glow-highlight)' : undefined}
          />
        </g>

        {/* 2. Halfway Line */}
        <g
          className="cursor-pointer transition-colors"
          onClick={() => handleMarkingClick('Halfway Line')}
          onMouseEnter={() => setHoveredMarking('Halfway Line')}
          onMouseLeave={() => setHoveredMarking(null)}
        >
          <line
            x1={cx}
            y1={fy}
            x2={cx}
            y2={fy + W}
            stroke={isMarkingActive('Halfway Line') ? colors.linesActive : colors.lines}
            strokeWidth={isMarkingActive('Halfway Line') ? '0.7' : '0.4'}
            filter={isMarkingActive('Halfway Line') ? 'url(#glow-highlight)' : undefined}
          />
        </g>

        {/* 3. Center Circle & Center Spot */}
        <g
          className="cursor-pointer transition-colors"
          onClick={() => handleMarkingClick('Center Circle')}
          onMouseEnter={() => setHoveredMarking('Center Circle')}
          onMouseLeave={() => setHoveredMarking(null)}
        >
          {/* Center Circle */}
          <circle
            cx={cx}
            cy={cy}
            r={dim.centerCircleRadius}
            fill="none"
            stroke={isMarkingActive('Center Circle') ? colors.linesActive : colors.lines}
            strokeWidth={isMarkingActive('Center Circle') ? '0.7' : '0.4'}
            filter={isMarkingActive('Center Circle') ? 'url(#glow-highlight)' : undefined}
          />
          {/* Center Spot */}
          <circle
            cx={cx}
            cy={cy}
            r={0.45}
            fill={isMarkingActive('Center Circle') ? colors.linesActive : colors.lines}
          />
        </g>

        {/* 4. Youth Build-Out Lines (if applicable for 7v7 / marked) */}
        {dim.hasBuildOutLine && dim.buildOutDist > 0 && (
          <g
            className="cursor-pointer transition-colors"
            onClick={() => handleMarkingClick('Build-Out Lines')}
            onMouseEnter={() => setHoveredMarking('Build-Out Lines')}
            onMouseLeave={() => setHoveredMarking(null)}
          >
            {/* Left Build Out Line */}
            <line
              x1={fx + dim.buildOutDist}
              y1={fy}
              x2={fx + dim.buildOutDist}
              y2={fy + W}
              stroke={colors.buildOut}
              strokeWidth={isMarkingActive('Build-Out') ? '0.7' : '0.4'}
              strokeDasharray="1.2 0.8"
              filter={isMarkingActive('Build-Out') ? 'url(#glow-highlight)' : undefined}
            />
            {/* Right Build Out Line */}
            <line
              x1={fx + L - dim.buildOutDist}
              y1={fy}
              x2={fx + L - dim.buildOutDist}
              y2={fy + W}
              stroke={colors.buildOut}
              strokeWidth={isMarkingActive('Build-Out') ? '0.7' : '0.4'}
              strokeDasharray="1.2 0.8"
              filter={isMarkingActive('Build-Out') ? 'url(#glow-highlight)' : undefined}
            />
            {/* Tiny Label */}
            <text
              x={fx + dim.buildOutDist}
              y={fy + 2.5}
              fill={colors.buildOut}
              fontSize="1.1"
              fontFamily="sans-serif"
              fontWeight="600"
              textAnchor="middle"
              transform={`rotate(-90 ${fx + dim.buildOutDist} ${fy + 2.5})`}
            >
              BUILD-OUT LINE
            </text>
            <text
              x={fx + L - dim.buildOutDist}
              y={fy + 2.5}
              fill={colors.buildOut}
              fontSize="1.1"
              fontFamily="sans-serif"
              fontWeight="600"
              textAnchor="middle"
              transform={`rotate(-90 ${fx + L - dim.buildOutDist} ${fy + 2.5})`}
            >
              BUILD-OUT LINE
            </text>
          </g>
        )}

        {/* 5. Penalty Areas (Left & Right) */}
        {dim.penaltyDepth > 0 && dim.penaltyWidth > 0 && (
          <g
            className="cursor-pointer transition-colors"
            onClick={() => handleMarkingClick('Penalty Area')}
            onMouseEnter={() => setHoveredMarking('Penalty Area')}
            onMouseLeave={() => setHoveredMarking(null)}
          >
            {/* Left Penalty Box */}
            <rect
              x={fx}
              y={cy - dim.penaltyWidth / 2}
              width={dim.penaltyDepth}
              height={dim.penaltyWidth}
              fill={isMarkingActive('Penalty Area') ? 'rgba(251, 191, 36, 0.15)' : 'none'}
              stroke={isMarkingActive('Penalty Area') ? colors.linesActive : colors.lines}
              strokeWidth={isMarkingActive('Penalty Area') ? '0.7' : '0.4'}
              filter={isMarkingActive('Penalty Area') ? 'url(#glow-highlight)' : undefined}
            />
            {/* Right Penalty Box */}
            <rect
              x={fx + L - dim.penaltyDepth}
              y={cy - dim.penaltyWidth / 2}
              width={dim.penaltyDepth}
              height={dim.penaltyWidth}
              fill={isMarkingActive('Penalty Area') ? 'rgba(251, 191, 36, 0.15)' : 'none'}
              stroke={isMarkingActive('Penalty Area') ? colors.linesActive : colors.lines}
              strokeWidth={isMarkingActive('Penalty Area') ? '0.7' : '0.4'}
              filter={isMarkingActive('Penalty Area') ? 'url(#glow-highlight)' : undefined}
            />
          </g>
        )}

        {/* 6. Goal Areas / 6-Yard Box (Left & Right) */}
        {dim.goalAreaDepth > 0 && dim.goalAreaWidth > 0 && (
          <g
            className="cursor-pointer transition-colors"
            onClick={() => handleMarkingClick('Goal Area')}
            onMouseEnter={() => setHoveredMarking('Goal Area')}
            onMouseLeave={() => setHoveredMarking(null)}
          >
            {/* Left Goal Area */}
            <rect
              x={fx}
              y={cy - dim.goalAreaWidth / 2}
              width={dim.goalAreaDepth}
              height={dim.goalAreaWidth}
              fill={isMarkingActive('Goal Area') ? 'rgba(251, 191, 36, 0.18)' : 'none'}
              stroke={isMarkingActive('Goal Area') ? colors.linesActive : colors.lines}
              strokeWidth={isMarkingActive('Goal Area') ? '0.7' : '0.4'}
              filter={isMarkingActive('Goal Area') ? 'url(#glow-highlight)' : undefined}
            />
            {/* Right Goal Area */}
            <rect
              x={fx + L - dim.goalAreaDepth}
              y={cy - dim.goalAreaWidth / 2}
              width={dim.goalAreaDepth}
              height={dim.goalAreaWidth}
              fill={isMarkingActive('Goal Area') ? 'rgba(251, 191, 36, 0.18)' : 'none'}
              stroke={isMarkingActive('Goal Area') ? colors.linesActive : colors.lines}
              strokeWidth={isMarkingActive('Goal Area') ? '0.7' : '0.4'}
              filter={isMarkingActive('Goal Area') ? 'url(#glow-highlight)' : undefined}
            />
          </g>
        )}

        {/* 7. Penalty Spots (Left & Right) */}
        {dim.penaltySpotDist > 0 && (
          <g
            className="cursor-pointer transition-colors"
            onClick={() => handleMarkingClick('Penalty Spot')}
            onMouseEnter={() => setHoveredMarking('Penalty Spot')}
            onMouseLeave={() => setHoveredMarking(null)}
          >
            {/* Left Penalty Spot */}
            <circle
              cx={fx + dim.penaltySpotDist}
              cy={cy}
              r={isMarkingActive('Penalty Spot') ? 0.6 : 0.45}
              fill={isMarkingActive('Penalty Spot') ? colors.linesActive : colors.lines}
              filter={isMarkingActive('Penalty Spot') ? 'url(#glow-highlight)' : undefined}
            />
            {/* Right Penalty Spot */}
            <circle
              cx={fx + L - dim.penaltySpotDist}
              cy={cy}
              r={isMarkingActive('Penalty Spot') ? 0.6 : 0.45}
              fill={isMarkingActive('Penalty Spot') ? colors.linesActive : colors.lines}
              filter={isMarkingActive('Penalty Spot') ? 'url(#glow-highlight)' : undefined}
            />
          </g>
        )}

        {/* 8. Penalty Arcs (The "D") */}
        {canDrawD && dOffsetY > 0 && (
          <g
            className="cursor-pointer transition-colors"
            onClick={() => handleMarkingClick('Penalty Arc')}
            onMouseEnter={() => setHoveredMarking('Penalty Arc')}
            onMouseLeave={() => setHoveredMarking(null)}
          >
            {/* Left Penalty Arc (curves to the right) */}
            <path
              d={`M ${fx + dim.penaltyDepth} ${cy - dOffsetY} A ${dim.penaltyArcRadius} ${dim.penaltyArcRadius} 0 0 1 ${fx + dim.penaltyDepth} ${cy + dOffsetY}`}
              fill="none"
              stroke={isMarkingActive('Penalty Arc') ? colors.linesActive : colors.lines}
              strokeWidth={isMarkingActive('Penalty Arc') ? '0.7' : '0.4'}
              filter={isMarkingActive('Penalty Arc') ? 'url(#glow-highlight)' : undefined}
            />
            {/* Right Penalty Arc (curves to the left) */}
            <path
              d={`M ${fx + L - dim.penaltyDepth} ${cy - dOffsetY} A ${dim.penaltyArcRadius} ${dim.penaltyArcRadius} 0 0 0 ${fx + L - dim.penaltyDepth} ${cy + dOffsetY}`}
              fill="none"
              stroke={isMarkingActive('Penalty Arc') ? colors.linesActive : colors.lines}
              strokeWidth={isMarkingActive('Penalty Arc') ? '0.7' : '0.4'}
              filter={isMarkingActive('Penalty Arc') ? 'url(#glow-highlight)' : undefined}
            />
          </g>
        )}

        {/* 9. Corner Arcs (All 4 corners) */}
        <g
          className="cursor-pointer transition-colors"
          onClick={() => handleMarkingClick('Corner Arcs')}
          onMouseEnter={() => setHoveredMarking('Corner Arcs')}
          onMouseLeave={() => setHoveredMarking(null)}
        >
          {/* Top Left */}
          <path
            d={`M ${fx + cornerR} ${fy} A ${cornerR} ${cornerR} 0 0 1 ${fx} ${fy + cornerR}`}
            fill="none"
            stroke={isMarkingActive('Corner Arcs') ? colors.linesActive : colors.lines}
            strokeWidth={isMarkingActive('Corner Arcs') ? '0.7' : '0.4'}
          />
          {/* Bottom Left */}
          <path
            d={`M ${fx} ${fy + W - cornerR} A ${cornerR} ${cornerR} 0 0 1 ${fx + cornerR} ${fy + W}`}
            fill="none"
            stroke={isMarkingActive('Corner Arcs') ? colors.linesActive : colors.lines}
            strokeWidth={isMarkingActive('Corner Arcs') ? '0.7' : '0.4'}
          />
          {/* Top Right */}
          <path
            d={`M ${fx + L - cornerR} ${fy} A ${cornerR} ${cornerR} 0 0 0 ${fx + L} ${fy + cornerR}`}
            fill="none"
            stroke={isMarkingActive('Corner Arcs') ? colors.linesActive : colors.lines}
            strokeWidth={isMarkingActive('Corner Arcs') ? '0.7' : '0.4'}
          />
          {/* Bottom Right */}
          <path
            d={`M ${fx + L} ${fy + W - cornerR} A ${cornerR} ${cornerR} 0 0 0 ${fx + L - cornerR} ${fy + W}`}
            fill="none"
            stroke={isMarkingActive('Corner Arcs') ? colors.linesActive : colors.lines}
            strokeWidth={isMarkingActive('Corner Arcs') ? '0.7' : '0.4'}
          />
        </g>

        {/* 10. Corner Flags */}
        <g
          className="cursor-pointer"
          onClick={() => handleMarkingClick('Corner Flags')}
          onMouseEnter={() => setHoveredMarking('Corner Flags')}
          onMouseLeave={() => setHoveredMarking(null)}
        >
          {/* 4 Corner Flag Pins */}
          {[
            { x: fx, y: fy },
            { x: fx + L, y: fy },
            { x: fx, y: fy + W },
            { x: fx + L, y: fy + W },
          ].map((pos, i) => (
            <g key={i}>
              <circle cx={pos.x} cy={pos.y} r={0.35} fill="#ffffff" />
              <polygon
                points={`${pos.x},${pos.y} ${pos.x + 0.9},${pos.y - 0.7} ${pos.x},${pos.y - 1.2}`}
                fill={colors.cornerFlag}
                stroke="#ffffff"
                strokeWidth="0.1"
              />
            </g>
          ))}
        </g>

        {/* 11. Goals & Netting (Left & Right) */}
        <g
          className="cursor-pointer transition-colors"
          onClick={() => handleMarkingClick('Goals')}
          onMouseEnter={() => setHoveredMarking('Goals')}
          onMouseLeave={() => setHoveredMarking(null)}
        >
          {/* Left Goal Net & Frame */}
          <rect
            x={fx - dim.goalDepth}
            y={cy - dim.goalWidth / 2}
            width={dim.goalDepth}
            height={dim.goalWidth}
            fill="url(#goal-net)"
            stroke={isMarkingActive('Goals') ? colors.linesActive : colors.goals}
            strokeWidth={isMarkingActive('Goals') ? '0.7' : '0.5'}
            filter={isMarkingActive('Goals') ? 'url(#glow-highlight)' : undefined}
          />
          {/* Left Goal Posts & Crossbar */}
          <line
            x1={fx}
            y1={cy - dim.goalWidth / 2}
            x2={fx}
            y2={cy + dim.goalWidth / 2}
            stroke="#ffffff"
            strokeWidth="0.6"
          />

          {/* Right Goal Net & Frame */}
          <rect
            x={fx + L}
            y={cy - dim.goalWidth / 2}
            width={dim.goalDepth}
            height={dim.goalWidth}
            fill="url(#goal-net)"
            stroke={isMarkingActive('Goals') ? colors.linesActive : colors.goals}
            strokeWidth={isMarkingActive('Goals') ? '0.7' : '0.5'}
            filter={isMarkingActive('Goals') ? 'url(#glow-highlight)' : undefined}
          />
          {/* Right Goal Posts & Crossbar */}
          <line
            x1={fx + L}
            y1={cy - dim.goalWidth / 2}
            x2={fx + L}
            y2={cy + dim.goalWidth / 2}
            stroke="#ffffff"
            strokeWidth="0.6"
          />
        </g>

        {/* 12. Technical Areas & Team Benches (Along Bottom Sideline) */}
        <g
          className="cursor-pointer transition-colors"
          onClick={() => handleMarkingClick('Technical Areas')}
          onMouseEnter={() => setHoveredMarking('Technical Areas')}
          onMouseLeave={() => setHoveredMarking(null)}
        >
          {/* Home Technical Area Box */}
          <rect
            x={homeTechX}
            y={techY}
            width={techWidth}
            height={techDepth}
            fill={colors.technicalArea}
            stroke={isMarkingActive('Technical Areas') ? colors.linesActive : colors.technicalBorder}
            strokeWidth="0.3"
            strokeDasharray="0.8 0.5"
            rx={0.3}
          />
          <text
            x={homeTechX + techWidth / 2}
            y={techY + techDepth * 0.65}
            fill={isBlueprint ? '#38bdf8' : '#ffffff'}
            fontSize="1.1"
            fontFamily="sans-serif"
            fontWeight="600"
            textAnchor="middle"
          >
            HOME BENCH
          </text>

          {/* Away Technical Area Box */}
          <rect
            x={awayTechX}
            y={techY}
            width={techWidth}
            height={techDepth}
            fill={colors.technicalArea}
            stroke={isMarkingActive('Technical Areas') ? colors.linesActive : colors.technicalBorder}
            strokeWidth="0.3"
            strokeDasharray="0.8 0.5"
            rx={0.3}
          />
          <text
            x={awayTechX + techWidth / 2}
            y={techY + techDepth * 0.65}
            fill={isBlueprint ? '#38bdf8' : '#ffffff'}
            fontSize="1.1"
            fontFamily="sans-serif"
            fontWeight="600"
            textAnchor="middle"
          >
            AWAY BENCH
          </text>

          {/* Fourth Official / Referee Table mark at midfield */}
          <rect
            x={cx - 1.2}
            y={techY + 0.2}
            width={2.4}
            height={techDepth * 0.7}
            fill="rgba(255, 255, 255, 0.2)"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="0.2"
            rx={0.2}
          />
        </g>

        {/* 13. Spectator Sideline (Along Top Sideline) */}
        <g>
          <line
            x1={fx + 5}
            y1={fy - 2.5}
            x2={fx + L - 5}
            y2={fy - 2.5}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="0.2"
            strokeDasharray="1.0 1.0"
          />
          <text
            x={cx}
            y={fy - 3.2}
            fill="rgba(255, 255, 255, 0.75)"
            fontSize="1.0"
            fontFamily="sans-serif"
            textAnchor="middle"
            letterSpacing="0.05em"
          >
            SPECTATOR & PARENT SEATING SIDELINE (STAY 2 YARDS BEHIND TOUCHLINE)
          </text>
        </g>

        {/* ================= DIMENSION CALLOUTS ================= */}
        {showDimensions && (
          <g>
            {/* Pitch Length Dimension Line (Bottom) */}
            <g>
              <line
                x1={fx}
                y1={fy + W + marginY * 0.9}
                x2={fx + L}
                y2={fy + W + marginY * 0.9}
                stroke={colors.dimensions}
                strokeWidth="0.25"
              />
              {/* Tick marks */}
              <line
                x1={fx}
                y1={fy + W + marginY * 0.7}
                x2={fx}
                y2={fy + W + marginY * 1.0}
                stroke={colors.dimensions}
                strokeWidth="0.25"
              />
              <line
                x1={fx + L}
                y1={fy + W + marginY * 0.7}
                x2={fx + L}
                y2={fy + W + marginY * 1.0}
                stroke={colors.dimensions}
                strokeWidth="0.25"
              />
              <rect
                x={cx - 18}
                y={fy + W + marginY * 0.72}
                width={36}
                height={2.2}
                fill={colors.bg}
                rx={0.4}
              />
              <text
                x={cx}
                y={fy + W + marginY * 0.9 + 0.4}
                fill={colors.dimensions}
                fontSize="1.15"
                fontFamily="sans-serif"
                fontWeight="700"
                textAnchor="middle"
              >
                LENGTH: {dim.lengthYards} yds ({dim.lengthMeters} m)
              </text>
            </g>

            {/* Pitch Width Dimension Line (Left Side) */}
            <g>
              <line
                x1={fx - marginX * 0.85}
                y1={fy}
                x2={fx - marginX * 0.85}
                y2={fy + W}
                stroke={colors.dimensions}
                strokeWidth="0.25"
              />
              {/* Tick marks */}
              <line
                x1={fx - marginX * 0.95}
                y1={fy}
                x2={fx - marginX * 0.75}
                y2={fy}
                stroke={colors.dimensions}
                strokeWidth="0.25"
              />
              <line
                x1={fx - marginX * 0.95}
                y1={fy + W}
                x2={fx - marginX * 0.75}
                y2={fy + W}
                stroke={colors.dimensions}
                strokeWidth="0.25"
              />
              <text
                x={fx - marginX * 0.85 - 0.6}
                y={cy}
                fill={colors.dimensions}
                fontSize="1.15"
                fontFamily="sans-serif"
                fontWeight="700"
                textAnchor="middle"
                transform={`rotate(-90 ${fx - marginX * 0.85 - 0.6} ${cy})`}
              >
                WIDTH: {dim.widthYards} yds ({dim.widthMeters} m)
              </text>
            </g>

            {/* Goal Dimension Callout (Right Goal) */}
            <g>
              <text
                x={fx + L + dim.goalDepth + 0.7}
                y={cy}
                fill={colors.dimensions}
                fontSize="1.0"
                fontFamily="sans-serif"
                fontWeight="600"
                textAnchor="middle"
                transform={`rotate(90 ${fx + L + dim.goalDepth + 0.7} ${cy})`}
              >
                GOAL: {field.goalSize || `${dim.goalHeightFeet}ft × ${Math.round(dim.goalWidth * 3)}ft`}
              </text>
            </g>
          </g>
        )}

        {/* Orientation compass in corner */}
        {field.orientation && (
          <g transform={`translate(${fx + L - 6}, ${fy + 4.5})`}>
            <circle cx="0" cy="0" r="2.2" fill="rgba(0, 0, 0, 0.45)" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.2" />
            <polygon points="0,-1.7 0.6,0.2 0,0 -0.6,0.2" fill="#ef4444" />
            <polygon points="0,1.7 0.6,-0.2 0,0 -0.6,-0.2" fill="#ffffff" />
            <text x="0" y="-1.9" fill="#ffffff" fontSize="0.9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
              {field.orientation === 'East-West' ? 'E' : 'N'}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
