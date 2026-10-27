import React, { useState, useMemo } from 'react';
import { Bulletin, BulletinCategory, BulletinTargetAudience } from '../../types';
import { Printer, X, Megaphone, AlertCircle, Calendar, Shield, Tag } from 'lucide-react';
import { BulletinContent } from '../BulletinContent';

interface PrintBulletinsModalProps {
  bulletins: Bulletin[];
  seasonName?: string;
  onClose: () => void;
}

export const PrintBulletinsModal: React.FC<PrintBulletinsModalProps> = ({
  bulletins,
  seasonName = 'PitchMaster Soccer League',
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAudience, setSelectedAudience] = useState<string>('all');
  const [onlyActive, setOnlyActive] = useState<boolean>(true);

  const filteredBulletins = useMemo(() => {
    return bulletins
      .filter((b) => {
        if (onlyActive && !b.isActive) return false;
        if (selectedCategory !== 'all' && b.category !== selectedCategory) return false;
        if (selectedAudience !== 'all' && b.targetAudience && b.targetAudience !== 'All' && b.targetAudience !== selectedAudience) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Pinned first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Priority: urgent > important > normal
        const pOrder: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
        const aOrder = pOrder[a.priority] ?? 2;
        const bOrder = pOrder[b.priority] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // Date descending
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [bulletins, selectedCategory, selectedAudience, onlyActive]);

  const handlePrint = () => {
    window.print();
  };

  const categories: BulletinCategory[] = ['General', 'Weather', 'Field Closure', 'Schedule Update', 'Urgent'];
  const audiences: BulletinTargetAudience[] = ['All', 'Coaches', 'Parents', 'Referees'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="no-print p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                <Megaphone className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Print Bulletins & Announcements</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Select print filters or click Print below for a clean, professional printout or PDF.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Bulletins (PDF)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Close Print Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar (Hidden in Print) */}
        <div className="no-print p-3 sm:px-5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Audience:</span>
            <select
              value={selectedAudience}
              onChange={(e) => setSelectedAudience(e.target.value)}
              className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="all">All Audiences</option>
              {audiences.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>Active bulletins only ({filteredBulletins.length})</span>
          </label>
        </div>

        {/* Printable Sheet Viewport */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-white print:p-0 print:overflow-visible">
          {/* Printable Header */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-slate-900 tracking-tight">PitchMaster Soccer</span>
                  <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                    Official Bulletins
                  </span>
                </div>
                <h1 className="text-2xl font-black text-slate-900 mt-1">{seasonName}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official League Announcements, Weather Advisories & Field Status Updates
                </p>
              </div>

              <div className="text-right text-xs font-mono text-slate-600 shrink-0">
                <div>Printed: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div className="text-slate-400 text-[11px]">{filteredBulletins.length} Notice{filteredBulletins.length === 1 ? '' : 's'} Published</div>
              </div>
            </div>
          </div>

          {/* Bulletins List */}
          {filteredBulletins.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
              No bulletins match the current filter selection.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBulletins.map((b, index) => {
                const isUrgent = b.priority === 'urgent';
                const isImportant = b.priority === 'important';

                return (
                  <div
                    key={b.id || index}
                    className={`p-4 rounded-xl border text-left transition-colors break-inside-avoid ${
                      isUrgent
                        ? 'border-rose-300 bg-rose-50/50 text-rose-950'
                        : isImportant
                        ? 'border-amber-300 bg-amber-50/40 text-amber-950'
                        : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {b.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                            📌 Pinned
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                            b.category === 'Field Closure'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : b.category === 'Weather'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : b.category === 'Schedule Update'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {b.category}
                        </span>

                        {isUrgent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-600 text-white">
                            <AlertCircle className="w-3 h-3" /> Urgent
                          </span>
                        )}

                        {b.targetAudience && b.targetAudience !== 'All' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200">
                            Audience: {b.targetAudience}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                        {b.author && <span>By {b.author}</span>}
                        <span>{b.createdAt}</span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 tracking-tight mb-1.5">
                      {b.title}
                    </h3>

                    <BulletinContent content={b.content} className="font-normal" />

                    {b.expiresAt && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        <span>Valid through: {b.expiresAt}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Printable Footer */}
          <div className="pt-4 border-t border-slate-200 text-center text-xs text-slate-500 flex items-center justify-between">
            <span>Official League Communication · Not for redistribution without coordinator authorization</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
