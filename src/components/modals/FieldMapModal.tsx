import React, { useState, useMemo } from 'react';
import { Division, Field } from '../../types';
import {
  X,
  MapPin,
  ExternalLink,
  Calendar,
  Layers,
  ShieldAlert,
  Compass,
  Ruler,
  Info,
  CheckCircle2,
  Sparkles,
  Sun,
  Moon,
  Footprints,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import { SoccerFieldGraphic, getFieldDimensions } from '../SoccerFieldGraphic';

interface FieldMapModalProps {
  field: Field | null;
  divisions: Division[];
  onClose: () => void;
  onEditField?: (field: Field) => void;
}

type ModalTab = 'diagram' | 'location' | 'divisions';

interface MarkingExplanation {
  title: string;
  category: string;
  description: string;
  dimensionsNote?: string;
}

const MARKING_DETAILS: Record<string, MarkingExplanation> = {
  'Touchlines & Goal Lines': {
    title: 'Touchlines & Goal Lines',
    category: 'Outer Boundaries',
    description: 'The perimeter boundary of the pitch. Touchlines form the long sides and goal lines form the short ends. The entire ball must cross the outer edge of the line to be out of bounds.',
    dimensionsNote: 'Regulation full-width white chalk or paint boundary.',
  },
  'Halfway Line': {
    title: 'Halfway Line & Center Spot',
    category: 'Field Division',
    description: 'Divides the pitch into two identical attacking and defending halves. Features the center spot for opening kickoffs and restarts after each goal.',
    dimensionsNote: 'Bisects the touchlines at exact midpoint.',
  },
  'Center Circle': {
    title: 'Center Circle',
    category: 'Kickoff Regulation',
    description: 'Enforces defending team retreat distance during kickoffs. Opponents must remain outside this circle until the ball is kicked into play.',
    dimensionsNote: '10yd radius (11v11), 8yd (9v9), 7yd (7v7), or 3m (Futsal).',
  },
  'Penalty Area': {
    title: 'Penalty Area (18-Yard Box)',
    category: 'Sanction Zone',
    description: 'Zone where the goalkeeper may legally handle the ball with their hands. Direct free kick fouls by the defending team inside this box result in a penalty kick.',
    dimensionsNote: '18 yds deep × 44 yds wide (11v11) or scaled format equivalent.',
  },
  'Goal Area': {
    title: 'Goal Area (6-Yard Box)',
    category: 'Goal Kick Zone',
    description: 'All defending goal kicks are taken from within this box. Indirect free kicks awarded to attacking team within this box are taken on the outer line.',
    dimensionsNote: '6 yds deep × 20 yds wide (11v11) or scaled format equivalent.',
  },
  'Penalty Spot': {
    title: 'Penalty Spot (Spot Kick Mark)',
    category: 'Penalty Kicks',
    description: 'Official spot where the ball is placed for penalty kicks during regulation and post-match penalty shootouts.',
    dimensionsNote: '12 yds from goal line (11v11), 10 yds (9v9), 8 yds (7v7), 6m (Futsal).',
  },
  'Penalty Arc': {
    title: 'Penalty Arc ("The D")',
    category: 'Penalty Kick Clearance',
    description: 'Arc drawn outside the top of the penalty box. All players except the penalty taker and goalkeeper must stand outside this arc during a penalty kick.',
    dimensionsNote: '10yd radius centered on the penalty spot.',
  },
  'Corner Arcs': {
    title: 'Corner Arcs',
    category: 'Set Piece Arc',
    description: 'Defines the legal area for placing the ball during corner kicks. Defending players must remain at least 10 yards away.',
    dimensionsNote: '1-yard (1-meter) radius quadrant at each corner.',
  },
  'Corner Flags': {
    title: 'Corner Flags',
    category: 'Safety & Orientation',
    description: 'Standard upright flags placed at all four corners to help officials judge touchline vs goal line out-of-bounds.',
    dimensionsNote: 'Minimum 5ft tall with non-pointed tops for player safety.',
  },
  'Build-Out Lines': {
    title: 'Build-Out Lines (Youth Retreat Rule)',
    category: 'Player Development',
    description: 'US Youth Soccer rule for 7v7 play. Promotes playing out from the back. Opponents must retreat behind this line when the goalkeeper holds the ball or on goal kicks.',
    dimensionsNote: 'Marked halfway between the penalty area and midfield.',
  },
  'Goals': {
    title: 'Goals & Heavy-Duty Netting',
    category: 'Scoring Area',
    description: 'Official posts, crossbar, and deep nylon netting securely staked and weighted for match safety.',
    dimensionsNote: '8ft × 24ft (11v11), 7ft × 21ft (9v9), 6.5ft × 18.5ft (7v7).',
  },
  'Technical Areas': {
    title: 'Technical Areas & Team Benches',
    category: 'Team Management',
    description: 'Designated sideline boxes for coaches, substitutes, and team staff. Coaches must stay within this boundary to issue instructions.',
    dimensionsNote: 'Extends 1 yard from the touchline and up to 12 yards wide.',
  },
};

interface FieldMapModalContentProps {
  field: Field;
  divisions: Division[];
  onClose: () => void;
  onEditField?: (field: Field) => void;
}

const FieldMapModalContent: React.FC<FieldMapModalContentProps> = ({
  field,
  divisions,
  onClose,
  onEditField,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('diagram');
  const [styleMode, setStyleMode] = useState<'realistic' | 'blueprint'>('realistic');
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [selectedMarking, setSelectedMarking] = useState<string | null>(null);

  const dim = getFieldDimensions(field);
  const assignedDivisions = divisions.filter((d) => field.assignedDivisionIds?.includes(d.id));
  const mapsUrl =
    field.googleMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(field.address || field.name)}`;

  // Compile full markings list for this field
  const effectiveMarkings = useMemo(() => {
    if (field.markings && field.markings.length > 0) {
      return field.markings;
    }
    // Standard default markings based on field format
    const list = [
      'Touchlines & Goal Lines',
      'Halfway Line',
      'Center Circle',
      'Penalty Area',
      'Goal Area',
      'Penalty Spot',
      'Penalty Arc',
      'Corner Arcs',
      'Corner Flags',
      'Goals',
      'Technical Areas',
    ];
    if (dim.hasBuildOutLine) {
      list.splice(4, 0, 'Build-Out Lines');
    }
    return list;
  }, [field.markings, dim.hasBuildOutLine]);

  // Footwear recommendation based on surface
  const footwearGuidance = useMemo(() => {
    switch (field.surfaceType) {
      case 'Artificial Turf':
        return {
          title: 'Artificial Grass (AG) or Multi-Ground (MG) Cleats',
          subtitle: 'Rubber molded studs or dedicated turf shoes. Metal studs strictly prohibited.',
        };
      case 'Indoor / Futsal':
        return {
          title: 'Flat Non-Marking Rubber Soles (IC)',
          subtitle: 'Indoor court shoes only. Cleats or spiked shoes not permitted.',
        };
      case 'Hybrid':
        return {
          title: 'Firm Ground (FG) or Hybrid Soft Ground Cleats',
          subtitle: 'Reinforced hybrid pitch suitable for molded or soft ground studs.',
        };
      case 'Natural Grass':
      default:
        return {
          title: 'Firm Ground (FG) Cleats',
          subtitle: 'Standard molded conical or bladed cleats for natural grass turf.',
        };
    }
  }, [field.surfaceType]);

  // Selected marking explanation detail
  const currentExplanation = useMemo(() => {
    if (!selectedMarking) return null;
    // Find closest key
    const match = Object.keys(MARKING_DETAILS).find(
      (k) =>
        selectedMarking.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(selectedMarking.toLowerCase())
    );
    if (match) {
      return MARKING_DETAILS[match];
    }
    return {
      title: selectedMarking,
      category: 'Field Marking',
      description: `Official marked pitch feature for ${field.name}.`,
    };
  }, [selectedMarking, field.name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900 leading-tight">{field.name}</h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  {field.size || 'Regulation'}
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {field.surfaceType || 'Natural Grass'}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>{dim.lengthYards} × {dim.widthYards} yards ({dim.lengthMeters} × {dim.widthMeters} m)</span>
                {field.orientation && (
                  <>
                    <span>·</span>
                    <span>{field.orientation} orientation</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 px-6 bg-white shrink-0 gap-6">
          <button
            onClick={() => setActiveTab('diagram')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'diagram'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ruler className="w-4 h-4" />
            <span>Field Diagram & Markings</span>
          </button>
          <button
            onClick={() => setActiveTab('location')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'location'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Location & GPS Navigation</span>
          </button>
          <button
            onClick={() => setActiveTab('divisions')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'divisions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Divisions & Rules ({assignedDivisions.length})</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {activeTab === 'diagram' && (
            <div className="space-y-5">
              {/* Toolbar Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Display Mode:</span>
                  <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-white">
                    <button
                      onClick={() => setStyleMode('realistic')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                        styleMode === 'realistic'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Realistic Pitch
                    </button>
                    <button
                      onClick={() => setStyleMode('blueprint')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                        styleMode === 'blueprint'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tactical Blueprint
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
                    <input
                      type="checkbox"
                      checked={showDimensions}
                      onChange={(e) => setShowDimensions(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="font-medium">Show Dimensions & Calipers</span>
                  </label>
                  {selectedMarking && (
                    <button
                      onClick={() => setSelectedMarking(null)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Reset Highlight
                    </button>
                  )}
                </div>
              </div>

              {/* Pitch Visual Representation */}
              <div className="relative rounded-2xl p-3 sm:p-4 bg-slate-950/90 shadow-inner flex flex-col items-center">
                <SoccerFieldGraphic
                  field={field}
                  interactive={true}
                  showDimensions={showDimensions}
                  activeMarking={selectedMarking}
                  onSelectMarking={(m) => setSelectedMarking(m)}
                  styleMode={styleMode}
                />
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  💡 Tip: Click or hover any marking below or on the field diagram to inspect regulation dimensions and rules.
                </p>
              </div>

              {/* Highlighted Marking Callout Card */}
              {currentExplanation && (
                <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-200 text-blue-900">
                          {currentExplanation.category}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{currentExplanation.title}</h4>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {currentExplanation.description}
                      </p>
                      {currentExplanation.dimensionsNote && (
                        <p className="text-xs font-mono text-blue-900 pt-1">
                          📐 <span className="font-semibold">Dimensions Spec:</span> {currentExplanation.dimensionsNote}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedMarking(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Pitch Specifications Key Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Dimensions
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {dim.lengthYards} × {dim.widthYards} yds
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {dim.lengthMeters} × {dim.widthMeters} meters
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Goal Frame
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {field.goalSize || `${dim.goalHeightFeet}ft × ${Math.round(dim.goalWidth * 3)}ft`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Anchored Posts & Netting
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Surface & Lights
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {field.surfaceType || 'Natural Grass'}
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    {field.hasLighting ? (
                      <span className="text-emerald-700 font-medium">⚡ Night Lights On</span>
                    ) : (
                      <span>☀️ Daylight Only</span>
                    )}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Orientation
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {field.orientation || 'North-South'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {field.orientation === 'East-West' ? 'Low sun angle' : 'Optimal sun axis'}
                  </p>
                </div>
              </div>

              {/* Official Markings Explorer Tags */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Verified Field Markings & Lines ({effectiveMarkings.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">Click to locate on diagram</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {effectiveMarkings.map((marking) => {
                    const isSelected = selectedMarking === marking;
                    return (
                      <button
                        key={marking}
                        onClick={() => setSelectedMarking(isSelected ? null : marking)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm scale-105'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                        }`}
                      >
                        <CheckCircle2 className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-950' : 'text-emerald-600'}`} />
                        <span>{marking}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footwear & Pitch Conditions Note */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                  <Footprints className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h5 className="text-xs font-bold text-slate-900">
                    Recommended Footwear: {footwearGuidance.title}
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {footwearGuidance.subtitle}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'location' && (
            <div className="space-y-6">
              {/* Static Street Address Card */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900">Field Address & Match Access</h4>
                    <p className="text-base font-semibold text-slate-900">
                      {field.address || 'Address not registered'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Official matchday pitch destination for players, coaches, referees, and families.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-3">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in Google Maps Directions</span>
                  </a>
                  <span className="text-xs text-slate-500">Live GPS navigation with real-time traffic updates</span>
                </div>
              </div>

              {/* Pitch Facility Notes */}
              {field.notes ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Pitch Facilities & Venue Notes
                  </h4>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    {field.notes}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 italic">
                  No additional venue or parking notes provided.
                </div>
              )}
            </div>
          )}

          {activeTab === 'divisions' && (
            <div className="space-y-6">
              {/* Assigned Divisions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span>Assigned Divisions ({assignedDivisions.length})</span>
                </div>
                {assignedDivisions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {assignedDivisions.map((div) => (
                      <div
                        key={div.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">{div.name}</p>
                          <p className="text-[11px] text-slate-500">
                            Match Length: {div.matchDurationMinutes} mins
                          </p>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 rounded">
                          Eligible
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-200">
                    This pitch is currently open to all divisions and not restricted to specific age formats.
                  </p>
                )}
              </div>

              {/* Field Blackout Dates */}
              {field.blackoutDates && field.blackoutDates.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Field Unavailable Dates ({field.blackoutDates.length})</span>
                  </div>
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                    <p className="text-xs text-amber-900 font-medium">
                      The automated scheduler blocks these dates from hosting matches (e.g., municipal maintenance, city events):
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {field.blackoutDates.map((date) => (
                        <span
                          key={date}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono tabular-nums text-amber-950 bg-amber-100 rounded-lg border border-amber-300 font-semibold"
                        >
                          <Calendar className="w-3.5 h-3.5 text-amber-700" />
                          {date}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No blackout dates registered. This pitch is available every scheduled match weekend.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <div className="text-xs text-slate-500 hidden sm:block">
            <span>{field.name}</span> · <span className="font-mono">{dim.lengthYards}×{dim.widthYards}yd</span>
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            {onEditField && (
              <button
                onClick={() => {
                  onClose();
                  onEditField(field);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Edit Pitch Specifications
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FieldMapModal: React.FC<FieldMapModalProps> = ({
  field,
  divisions,
  onClose,
  onEditField,
}) => {
  if (!field) return null;

  return (
    <FieldMapModalContent
      field={field}
      divisions={divisions}
      onClose={onClose}
      onEditField={onEditField}
    />
  );
};

