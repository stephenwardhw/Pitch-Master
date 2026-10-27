import React, { useState, useMemo } from 'react';
import { AppData, Bulletin, BulletinCategory, BulletinPriority, BulletinTargetAudience } from '../types';
import {
  Megaphone,
  Plus,
  Printer,
  Search,
  Pin,
  PinOff,
  Edit2,
  Trash2,
  CheckCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  Calendar,
  Filter,
  User,
  Clock,
  Sparkles,
} from 'lucide-react';
import { PrintBulletinsModal } from './modals/PrintBulletinsModal';
import { AdminUser } from '../utils/authClient';

interface BulletinsPageProps {
  appData: AppData;
  adminUser?: AdminUser | null;
  onSaveBulletin: (bulletin: Bulletin) => void;
  onDeleteBulletin: (bulletinId: string) => void;
  onTogglePinBulletin: (bulletinId: string) => void;
  onToggleActiveBulletin: (bulletinId: string) => void;
}

export const BulletinsPage: React.FC<BulletinsPageProps> = ({
  appData,
  adminUser,
  onSaveBulletin,
  onDeleteBulletin,
  onTogglePinBulletin,
  onToggleActiveBulletin,
}) => {
  const bulletins = useMemo(() => appData.bulletins || [], [appData.bulletins]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedAudience, setSelectedAudience] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Edit / Create modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingBulletin, setEditingBulletin] = useState<Bulletin | null>(null);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<BulletinCategory>('General');
  const [formPriority, setFormPriority] = useState<BulletinPriority>('normal');
  const [formAudience, setFormAudience] = useState<BulletinTargetAudience>('All');
  const [formAuthor, setFormAuthor] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingBulletin(null);
    setFormTitle('');
    setFormContent('');
    setFormCategory('General');
    setFormPriority('normal');
    setFormAudience('All');
    setFormAuthor(adminUser?.displayName || adminUser?.username || 'League Admin');
    setFormExpiresAt('');
    setFormIsPinned(false);
    setFormIsActive(true);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (bulletin: Bulletin) => {
    setEditingBulletin(bulletin);
    setFormTitle(bulletin.title);
    setFormContent(bulletin.content);
    setFormCategory(bulletin.category);
    setFormPriority(bulletin.priority);
    setFormAudience(bulletin.targetAudience || 'All');
    setFormAuthor(bulletin.author || 'League Admin');
    setFormExpiresAt(bulletin.expiresAt || '');
    setFormIsPinned(!!bulletin.isPinned);
    setFormIsActive(bulletin.isActive);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Please enter a bulletin title.');
      return;
    }
    if (!formContent.trim()) {
      setFormError('Please enter bulletin message content.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const newBulletin: Bulletin = {
      id: editingBulletin ? editingBulletin.id : `bulletin-${Date.now()}`,
      title: formTitle.trim(),
      content: formContent.trim(),
      category: formCategory,
      priority: formPriority,
      targetAudience: formAudience,
      author: formAuthor.trim() || 'League Admin',
      createdAt: editingBulletin ? editingBulletin.createdAt : todayStr,
      updatedAt: todayStr,
      expiresAt: formExpiresAt.trim() || undefined,
      isPinned: formIsPinned,
      isActive: formIsActive,
    };

    onSaveBulletin(newBulletin);
    setIsEditorOpen(false);
  };

  // Filtered & sorted bulletins
  const filteredBulletins = useMemo(() => {
    return bulletins
      .filter((b) => {
        if (statusFilter === 'active' && !b.isActive) return false;
        if (statusFilter === 'inactive' && b.isActive) return false;
        if (selectedCategory !== 'all' && b.category !== selectedCategory) return false;
        if (selectedPriority !== 'all' && b.priority !== selectedPriority) return false;
        if (selectedAudience !== 'all' && b.targetAudience && b.targetAudience !== 'All' && b.targetAudience !== selectedAudience) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const title = b.title.toLowerCase();
          const content = b.content.toLowerCase();
          const author = (b.author || '').toLowerCase();
          return title.includes(q) || content.includes(q) || author.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [bulletins, statusFilter, selectedCategory, selectedPriority, selectedAudience, searchQuery]);

  // Counts
  const totalCount = bulletins.length;
  const activeCount = bulletins.filter((b) => b.isActive).length;
  const pinnedCount = bulletins.filter((b) => b.isPinned && b.isActive).length;
  const urgentCount = bulletins.filter((b) => b.priority === 'urgent' && b.isActive).length;

  const categories: BulletinCategory[] = ['General', 'Weather', 'Field Closure', 'Schedule Update', 'Urgent'];
  const audiences: BulletinTargetAudience[] = ['All', 'Coaches', 'Parents', 'Referees'];

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-2xs">
              <Megaphone className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              League Bulletins & Announcements
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Create, publish, and manage notifications visible on the public Landing Page and Coach/Parent Portal sidebar.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Print bulletins separately without the match schedule"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Bulletins (PDF)</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Post New Bulletin</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Total Bulletins</span>
            <span className="text-xl font-black text-slate-900 leading-tight">{totalCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Active / Published</span>
            <span className="text-xl font-black text-slate-900 leading-tight">{activeCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <Pin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Pinned to Top</span>
            <span className="text-xl font-black text-slate-900 leading-tight">{pinnedCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">Urgent Alerts</span>
            <span className="text-xl font-black text-rose-700 leading-tight">{urgentCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search announcements by title, keyword, or author..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({bulletins.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'active' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'inactive' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Archived ({totalCount - activeCount})
              </button>
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Priority Dropdown */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="important">Important</option>
              <option value="normal">Normal</option>
            </select>

            {/* Target Audience Dropdown */}
            <select
              value={selectedAudience}
              onChange={(e) => setSelectedAudience(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="all">All Audiences</option>
              {audiences.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulletins List */}
      {filteredBulletins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Megaphone className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No bulletins found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'all' || statusFilter !== 'all'
              ? 'No announcements match your search filters. Try clearing filters or creating a new post.'
              : 'You have not created any bulletins yet. Post announcements, field closures, or weather notices for families and coaches.'}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Bulletin</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredBulletins.map((bulletin) => {
            const isUrgent = bulletin.priority === 'urgent';
            const isImportant = bulletin.priority === 'important';

            return (
              <div
                key={bulletin.id}
                className={`bg-white rounded-xl border p-5 transition-all shadow-2xs space-y-3 ${
                  !bulletin.isActive
                    ? 'border-slate-200 opacity-60 bg-slate-50/50'
                    : isUrgent
                    ? 'border-rose-300 bg-rose-50/20 ring-1 ring-rose-200'
                    : isImportant
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header line with badges and actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {bulletin.isPinned && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                        <Pin className="w-3 h-3 text-indigo-600 fill-indigo-600" />
                        Pinned to Top
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                        bulletin.category === 'Field Closure'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : bulletin.category === 'Weather'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : bulletin.category === 'Schedule Update'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {bulletin.category}
                    </span>

                    {isUrgent && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-600 text-white">
                        <AlertTriangle className="w-3 h-3" /> Urgent
                      </span>
                    )}

                    {bulletin.targetAudience && bulletin.targetAudience !== 'All' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200">
                        Audience: {bulletin.targetAudience}
                      </span>
                    )}

                    {!bulletin.isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-200 text-slate-700">
                        Draft / Inactive
                      </span>
                    )}
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onTogglePinBulletin(bulletin.id)}
                      className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        bulletin.isPinned
                          ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                      title={bulletin.isPinned ? 'Unpin bulletin' : 'Pin bulletin to top'}
                    >
                      {bulletin.isPinned ? <Pin className="w-4 h-4 fill-indigo-600" /> : <Pin className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleActiveBulletin(bulletin.id)}
                      className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        bulletin.isActive
                          ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                      title={bulletin.isActive ? 'Unpublish / Archive' : 'Publish bulletin'}
                    >
                      {bulletin.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(bulletin)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit Bulletin"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete bulletin "${bulletin.title}"?`)) {
                          onDeleteBulletin(bulletin.id);
                        }
                      }}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Bulletin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Title & Body */}
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    {bulletin.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 mt-1 leading-relaxed whitespace-pre-line">
                    {bulletin.content}
                  </p>
                </div>

                {/* Meta details footer */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-medium">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{bulletin.author || 'League Admin'}</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Posted: {bulletin.createdAt}</span>
                    </span>
                    {bulletin.expiresAt && (
                      <span className="flex items-center gap-1 font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        <span>Expires: {bulletin.expiresAt}</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                    ID: {bulletin.id}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Megaphone className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingBulletin ? 'Edit Bulletin Post' : 'Post New Bulletin'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
                  {formError}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bulletin Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Pitch 3 Closed Due to Weather - Field Relocations"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-900"
                  required
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as BulletinCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="General">General Announcement</option>
                    <option value="Weather">Weather Advisory</option>
                    <option value="Field Closure">Field Closure</option>
                    <option value="Schedule Update">Schedule Update</option>
                    <option value="Urgent">Urgent Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as BulletinPriority)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important (Yellow Callout)</option>
                    <option value="urgent">Urgent (Red Alert)</option>
                  </select>
                </div>
              </div>

              {/* Audience & Author */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Audience</label>
                  <select
                    value={formAudience}
                    onChange={(e) => setFormAudience(e.target.value as BulletinTargetAudience)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="All">All (Public & Everyone)</option>
                    <option value="Parents">Parents & Families</option>
                    <option value="Coaches">Coaches & Managers</option>
                    <option value="Referees">Match Officials</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Author Name / Department</label>
                  <input
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="e.g., League Coordinator"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Expiration date */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Content Body */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bulletin Message Content <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={5}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Provide complete details, instructions, rescheduled field/times, or protocol..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans"
                  required
                />
              </div>

              {/* Checkboxes: Pinned & Active */}
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-800">Pin to top of bulletin board</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-800">Publish immediately (Active)</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {editingBulletin ? 'Update Bulletin' : 'Publish Bulletin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Bulletins Modal */}
      {isPrintModalOpen && (
        <PrintBulletinsModal
          bulletins={bulletins}
          seasonName={appData.seasonConfig?.seasonName}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  );
};
