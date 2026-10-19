import React, { useState, useRef, useMemo } from 'react';
import { AppData } from '../../types';
import {
  parseTeamsFromCsv,
  parseScheduleFromCsv,
  parseFieldsFromCsv,
  applyTeamsImport,
  applyScheduleImport,
  applyFieldsImport,
  getTeamsCsvTemplate,
  getScheduleCsvTemplate,
  getFieldsCsvTemplate,
  exportTeamsToCsv,
  exportScheduleToCsv,
  exportFieldsToCsv,
  downloadCsv,
  TeamImportAnalysis,
  ScheduleImportAnalysis,
  FieldImportAnalysis,
} from '../../utils/csvImporter';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Users,
  Calendar,
  Layers,
  MapPin,
  Sparkles,
  RefreshCw,
  FileText,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Info,
} from 'lucide-react';

export type CsvImportType = 'teams' | 'fields' | 'schedule';

interface CsvImportModalProps {
  appData: AppData;
  initialType?: CsvImportType;
  onUpdateAppData: (updated: AppData) => void;
  onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  appData,
  initialType = 'teams',
  onUpdateAppData,
  onClose,
}) => {
  const [activeType, setActiveType] = useState<CsvImportType>(initialType);
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [createDivisions, setCreateDivisions] = useState<boolean>(true);
  const [createFields, setCreateFields] = useState<boolean>(true);
  const [createTeams, setCreateTeams] = useState<boolean>(true);
  const [isPastingText, setIsPastingText] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [successReport, setSuccessReport] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse whenever rawCsvText or activeType changes
  const teamAnalysis: TeamImportAnalysis | null = useMemo(() => {
    if (activeType !== 'teams' || !rawCsvText.trim()) return null;
    try {
      return parseTeamsFromCsv(rawCsvText, appData);
    } catch (err) {
      console.error('Error analyzing teams CSV:', err);
      return null;
    }
  }, [rawCsvText, activeType, appData]);

  const fieldAnalysis: FieldImportAnalysis | null = useMemo(() => {
    if (activeType !== 'fields' || !rawCsvText.trim()) return null;
    try {
      return parseFieldsFromCsv(rawCsvText, appData);
    } catch (err) {
      console.error('Error analyzing fields CSV:', err);
      return null;
    }
  }, [rawCsvText, activeType, appData]);

  const scheduleAnalysis: ScheduleImportAnalysis | null = useMemo(() => {
    if (activeType !== 'schedule' || !rawCsvText.trim()) return null;
    try {
      return parseScheduleFromCsv(rawCsvText, appData);
    } catch (err) {
      console.error('Error analyzing schedule CSV:', err);
      return null;
    }
  }, [rawCsvText, activeType, appData]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setSuccessReport(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawCsvText(content || '');
    };
    reader.readAsText(file);
  };

  // Handle template download
  const handleDownloadTemplate = (type: CsvImportType) => {
    const content =
      type === 'teams'
        ? getTeamsCsvTemplate()
        : type === 'fields'
        ? getFieldsCsvTemplate()
        : getScheduleCsvTemplate();
    const defaultName =
      type === 'teams'
        ? 'pitchmaster_teams_template.csv'
        : type === 'fields'
        ? 'pitchmaster_fields_template.csv'
        : 'pitchmaster_schedule_template.csv';

    downloadCsv(defaultName, content);
  };

  // Handle export current data in standard format
  const handleExportCurrent = (type: CsvImportType) => {
    const today = new Date().toISOString().slice(0, 10);
    if (type === 'teams') {
      const csv = exportTeamsToCsv(appData);
      downloadCsv(`pitchmaster_teams_${today}.csv`, csv);
    } else if (type === 'fields') {
      const csv = exportFieldsToCsv(appData);
      downloadCsv(`pitchmaster_fields_${today}.csv`, csv);
    } else {
      const csv = exportScheduleToCsv(appData);
      downloadCsv(`pitchmaster_schedule_${today}.csv`, csv);
    }
  };

  // Load sample data directly into preview
  const handleLoadSample = (type: CsvImportType) => {
    const sample =
      type === 'teams'
        ? getTeamsCsvTemplate()
        : type === 'fields'
        ? getFieldsCsvTemplate()
        : getScheduleCsvTemplate();
    setRawCsvText(sample);
    setFileName(
      type === 'teams'
        ? 'sample_teams.csv'
        : type === 'fields'
        ? 'sample_fields.csv'
        : 'sample_schedule.csv'
    );
    setSuccessReport(null);
  };

  // Execute import
  const handleExecuteImport = () => {
    setIsProcessing(true);
    try {
      if (activeType === 'teams' && teamAnalysis) {
        const updated = applyTeamsImport(appData, teamAnalysis, {
          mode: importMode,
          createMissingDivisions: createDivisions,
          createMissingFields: createFields,
        });

        onUpdateAppData(updated);
        const importedCount = teamAnalysis.validCount + teamAnalysis.warningCount;
        setSuccessReport(
          `Successfully imported ${importedCount} teams (${importMode === 'replace' ? 'replaced existing teams' : 'merged into league'})!` +
            (teamAnalysis.newDivisions.length > 0
              ? ` Created ${teamAnalysis.newDivisions.length} new division(s).`
              : '') +
            (teamAnalysis.newFields.length > 0
              ? ` Created ${teamAnalysis.newFields.length} new pitch(es).`
              : '')
        );
      } else if (activeType === 'fields' && fieldAnalysis) {
        const updated = applyFieldsImport(appData, fieldAnalysis, {
          mode: importMode,
          createMissingDivisions: createDivisions,
        });

        onUpdateAppData(updated);
        const importedCount = fieldAnalysis.validCount + fieldAnalysis.warningCount;
        setSuccessReport(
          `Successfully imported ${importedCount} pitches/fields (${importMode === 'replace' ? 'replaced existing fields' : 'merged into league'})!` +
            (fieldAnalysis.newDivisions.length > 0
              ? ` Created ${fieldAnalysis.newDivisions.length} new division(s).`
              : '')
        );
      } else if (activeType === 'schedule' && scheduleAnalysis) {
        const updated = applyScheduleImport(appData, scheduleAnalysis, {
          mode: importMode,
          createMissingTeams: createTeams,
          createMissingFields: createFields,
          createMissingDivisions: createDivisions,
        });

        onUpdateAppData(updated);
        const importedCount = scheduleAnalysis.validCount + scheduleAnalysis.warningCount;
        setSuccessReport(
          `Successfully imported ${importedCount} match fixtures (${importMode === 'replace' ? 'replaced existing schedule' : 'merged into league'})!` +
            (scheduleAnalysis.newTeams.length > 0
              ? ` Auto-created ${scheduleAnalysis.newTeams.length} new team(s).`
              : '') +
            (scheduleAnalysis.newFields.length > 0
              ? ` Auto-created ${scheduleAnalysis.newFields.length} new pitch(es).`
              : '')
        );
      }
    } catch (err: any) {
      alert(`Import error: ${err.message || 'Failed to process dataset import.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentAnalysis =
    activeType === 'teams'
      ? teamAnalysis
      : activeType === 'fields'
      ? fieldAnalysis
      : scheduleAnalysis;
  const hasRows = currentAnalysis && currentAnalysis.totalRows > 0;
  const canImport = currentAnalysis && currentAnalysis.validCount + currentAnalysis.warningCount > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                CSV Migration & Data Importer
              </h2>
              <p className="text-xs text-slate-500">
                Quickly import team rosters and match schedules from Excel or Google Sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Switcher Tabs */}
        <div className="px-6 pt-3 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveType('teams');
                setSuccessReport(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                activeType === 'teams'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Import Teams & Coaches</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                {appData.teams.length} teams
              </span>
            </button>

            <button
              onClick={() => {
                setActiveType('fields');
                setSuccessReport(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                activeType === 'fields'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Import Pitches & Fields</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                {appData.fields.length} pitches
              </span>
            </button>

            <button
              onClick={() => {
                setActiveType('schedule');
                setSuccessReport(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                activeType === 'schedule'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Import Match Schedule</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                {appData.games.length} games
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => handleExportCurrent(activeType)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-2xs"
              title={`Export current active ${activeType} to a CSV file`}
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export {activeType === 'teams' ? 'Teams' : activeType === 'fields' ? 'Fields' : 'Schedule'} (CSV)</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadTemplate(activeType)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              title="Download standard CSV spreadsheet template"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>Template</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Success Banner */}
          {successReport && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Import Completed Successfully</h4>
                  <p className="mt-0.5 text-emerald-800 leading-relaxed">{successReport}</p>
                </div>
              </div>
              <button
                onClick={() => setSuccessReport(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Upload Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700">
                Select CSV File or Paste Raw Spreadsheet Data:
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPastingText(!isPastingText)}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {isPastingText ? 'Hide Text Box' : 'Paste CSV Text'}
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample(activeType)}
                  className="text-emerald-700 hover:underline font-medium flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Load Sample CSV</span>
                </button>
              </div>
            </div>

            {/* Drag & Drop Card */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 rounded-xl p-5 text-center cursor-pointer transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 group-hover:border-emerald-300 mx-auto flex items-center justify-center text-slate-500 group-hover:text-emerald-600 shadow-2xs transition-colors">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-800 mt-2">
                {fileName ? (
                  <span className="text-emerald-700 font-mono font-bold">{fileName}</span>
                ) : (
                  <span>Click to choose a {activeType === 'teams' ? 'Teams' : 'Schedule'} CSV file</span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Supports commas, quotes, and standard header aliases automatically
              </p>
            </div>

            {/* Paste Raw Textarea */}
            {isPastingText && (
              <div className="space-y-1.5 animate-in fade-in">
                <label className="text-[11px] font-semibold text-slate-600 block">
                  Paste Raw CSV / Spreadsheet Rows:
                </label>
                <textarea
                  rows={4}
                  value={rawCsvText}
                  onChange={(e) => {
                    setRawCsvText(e.target.value);
                    setFileName('pasted_data.csv');
                    setSuccessReport(null);
                  }}
                  placeholder="Team Name,Division,Coach,Email,Phone,Home Field&#10;Strikers,U12 Boys,John Doe,john@test.com,(310) 555-0199,Memorial Park"
                  className="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Import Settings & Options */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 text-xs">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
              Import Configuration & Entity Mapping
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Import Mode */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Dataset Merge Strategy:</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700 font-medium">
                      <strong>Append & Update:</strong> Add new records, update matching names
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-slate-700 font-medium">
                      <strong>Replace All:</strong> Clear existing {activeType} and load CSV only
                    </span>
                  </label>
                </div>
              </div>

              {/* Auto Creation Options */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Automated Entity Resolution:</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createDivisions}
                      onChange={(e) => setCreateDivisions(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700">Auto-create new Divisions if found in CSV</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createFields}
                      onChange={(e) => setCreateFields(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700">Auto-create new Pitches / Fields if found in CSV</span>
                  </label>

                  {activeType === 'schedule' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createTeams}
                        onChange={(e) => setCreateTeams(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-slate-700">Auto-create missing Teams if found in Schedule</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Validation & Preview Section */}
          {hasRows && (
            <div className="space-y-3">
              {/* Analysis Summary Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-800">
                    Preview: {currentAnalysis.totalRows} row{currentAnalysis.totalRows !== 1 ? 's' : ''} detected
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {currentAnalysis.validCount} valid
                  </span>
                  {currentAnalysis.warningCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {currentAnalysis.warningCount} warnings
                    </span>
                  )}
                  {currentAnalysis.errorCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full font-bold">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {currentAnalysis.errorCount} errors
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-500">
                  Headers detected: {currentAnalysis.headersDetected.join(', ')}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-64 overflow-y-auto">
                {activeType === 'teams' && teamAnalysis && (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Team Name</th>
                        <th className="px-3 py-2">Division</th>
                        <th className="px-3 py-2">Coach / Contact</th>
                        <th className="px-3 py-2">Home Pitch</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {teamAnalysis.rows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            row.status === 'error'
                              ? 'bg-rose-50/60'
                              : row.status === 'warning'
                              ? 'bg-amber-50/40'
                              : ''
                          }`}
                        >
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                            #{row.rowIndex}
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-900">
                            {row.teamName || <span className="text-rose-500 italic">Empty</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {row.divisionName}
                            {row.isNewDivision && (
                              <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                +New Div
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {row.contactName || row.contactEmail || <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {row.primaryFieldName}
                            {row.isNewField && (
                              <span className="ml-1.5 px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                                +New Pitch
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.status === 'valid' ? (
                              <span className="text-emerald-700 font-semibold text-[11px]">Ready</span>
                            ) : row.status === 'warning' ? (
                              <span
                                className="text-amber-700 font-semibold text-[11px] cursor-help"
                                title={row.messages.join(' ')}
                              >
                                {row.messages[0]}
                              </span>
                            ) : (
                              <span
                                className="text-rose-700 font-semibold text-[11px] cursor-help"
                                title={row.messages.join(' ')}
                              >
                                {row.messages[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeType === 'fields' && fieldAnalysis && (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Pitch / Field Name</th>
                        <th className="px-3 py-2">Facility Address</th>
                        <th className="px-3 py-2">Assigned Divisions</th>
                        <th className="px-3 py-2">Size / Surface</th>
                        <th className="px-3 py-2">Blackout Dates</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {fieldAnalysis.rows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            row.status === 'error'
                              ? 'bg-rose-50/60'
                              : row.status === 'warning'
                              ? 'bg-amber-50/40'
                              : ''
                          }`}
                        >
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                            #{row.rowIndex}
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-900">
                            {row.fieldName || <span className="text-rose-500 italic">Empty</span>}
                            {row.isDuplicate && (
                              <span className="ml-1.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                                Exists
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate">
                            {row.address}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {row.assignedDivisionNames.join(', ') || <span className="text-slate-400">All Divisions</span>}
                            {row.newDivisions.length > 0 && (
                              <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                +{row.newDivisions.length} Div
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            <span className="font-semibold">{row.size}</span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span>{row.surfaceType}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                            {row.blackoutDates.length > 0 ? (
                              `${row.blackoutDates.length} date(s)`
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.status === 'valid' ? (
                              <span className="text-emerald-700 font-semibold text-[11px]">Ready</span>
                            ) : row.status === 'warning' ? (
                              <span
                                className="text-amber-700 font-semibold text-[11px] cursor-help"
                                title={row.messages.join(' ')}
                              >
                                {row.messages[0]}
                              </span>
                            ) : (
                              <span
                                className="text-rose-700 font-semibold text-[11px] cursor-help"
                                title={row.messages.join(' ')}
                              >
                                {row.messages[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeType === 'schedule' && scheduleAnalysis && (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Date & Time</th>
                        <th className="px-3 py-2">Matchup</th>
                        <th className="px-3 py-2">Pitch</th>
                        <th className="px-3 py-2">Division</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {scheduleAnalysis.rows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            row.rowStatus === 'error'
                              ? 'bg-rose-50/60'
                              : row.rowStatus === 'warning'
                              ? 'bg-amber-50/40'
                              : ''
                          }`}
                        >
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                            #{row.rowIndex}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                            <span className="font-mono">{row.date}</span> @ <span className="font-mono">{row.time}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-800 font-medium">
                            <span>{row.homeTeamName}</span>
                            <span className="text-slate-400 mx-1">vs</span>
                            <span>{row.awayTeamName}</span>
                            {(row.isNewHomeTeam || row.isNewAwayTeam) && (
                              <span className="ml-1.5 px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded text-[10px] font-bold">
                                +New Team
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600 truncate max-w-[140px]">
                            {row.fieldName}
                            {row.isNewField && (
                              <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                                +New
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{row.divisionName}</td>
                          <td className="px-3 py-2">
                            {row.rowStatus === 'valid' ? (
                              <span className="text-emerald-700 font-semibold text-[11px]">Ready</span>
                            ) : row.rowStatus === 'warning' ? (
                              <span
                                className="text-amber-700 font-semibold text-[11px] cursor-help"
                                title={row.messages.join(' ')}
                              >
                                {row.messages[0]}
                              </span>
                            ) : (
                              <span
                                className="text-rose-700 font-semibold text-[11px] cursor-help"
                                title={row.messages.join(' ')}
                              >
                                {row.messages[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Quick Help / Instructions */}
          <div className="bg-blue-50/60 rounded-xl border border-blue-200/70 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Tips for seamless CSV migration:</span>
              <p className="text-blue-800 leading-relaxed text-[11px]">
                {activeType === 'teams'
                  ? 'Column headers like "Team", "Division", "Coach", "Email", "Phone", and "Home Field" are recognized automatically. Divisions and Pitches referenced in the file can be created on-the-fly.'
                  : activeType === 'fields'
                  ? 'Column headers like "Field Name", "Address", "Google Maps URL", "Assigned Divisions", "Field Size", "Surface Type", and "Blackout Dates" are recognized automatically.'
                  : 'Column headers like "Date", "Time", "Home Team", "Away Team", "Field", and "Division" are recognized automatically. Dates like 2026-04-11 or 04/11/2026 and kickoff times like 09:00 or 9:00 AM are supported.'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadTemplate(activeType)}
              className="sm:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Template</span>
            </button>

            <button
              type="button"
              disabled={!canImport || isProcessing}
              onClick={handleExecuteImport}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Import...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    Commit & Import{' '}
                    {currentAnalysis ? currentAnalysis.validCount + currentAnalysis.warningCount : 0}{' '}
                    {activeType === 'teams' ? 'Teams' : activeType === 'fields' ? 'Pitches' : 'Matches'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
