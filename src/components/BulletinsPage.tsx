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
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Bold,
  Italic,
  Heading,
  List,
  Columns,
  ExternalLink,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { PrintBulletinsModal } from './modals/PrintBulletinsModal';
import { AdminUser } from '../utils/authClient';
import { BulletinContent, isHtmlContent } from './BulletinContent';

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

  // HTML Editor UX states
  const [editorMode, setEditorMode] = useState<'code' | 'preview' | 'split'>('split');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Link Dialog State
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTextInput, setLinkTextInput] = useState('');
  const [linkNewTab, setLinkNewTab] = useState(true);

  // Image Dialog State
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageAltInput, setImageAltInput] = useState('');
  const [imageCaptionInput, setImageCaptionInput] = useState('');

  // Helper to insert tags or snippets into textarea
  const insertSnippetAtCursor = (before: string, after = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setFormContent((prev) => prev + before + defaultText + after);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formContent.substring(start, end) || defaultText;
    const replacement = before + selectedText + after;

    const newContent = formContent.substring(0, start) + replacement + formContent.substring(end);
    setFormContent(newContent);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const handleOpenLinkDialog = () => {
    const textarea = textareaRef.current;
    const selected = textarea
      ? formContent.substring(textarea.selectionStart, textarea.selectionEnd)
      : '';
    setLinkTextInput(selected || 'Click here');
    setLinkUrlInput('https://');
    setLinkNewTab(true);
    setIsLinkDialogOpen(true);
  };

  const handleConfirmInsertLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrlInput.trim()) return;
    const targetAttr = linkNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
    const linkHtml = `<a href="${linkUrlInput.trim()}"${targetAttr} class="text-emerald-700 hover:text-emerald-900 underline font-semibold">${linkTextInput.trim() || linkUrlInput.trim()}</a>`;
    insertSnippetAtCursor(linkHtml, '', '');
    setIsLinkDialogOpen(false);
  };

  const handleOpenImageDialog = () => {
    setImageUrlInput('');
    setImageAltInput('Announcement photo');
    setImageCaptionInput('');
    setIsImageDialogOpen(true);
  };

  const handleConfirmInsertImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrlInput.trim()) return;
    const alt = imageAltInput.trim() || 'Bulletin image';
    let imgHtml = `<img src="${imageUrlInput.trim()}" alt="${alt}" class="rounded-xl max-w-full h-auto my-2 shadow-sm border border-slate-200" />`;
    if (imageCaptionInput.trim()) {
      imgHtml = `<figure class="my-3 text-center">\n  ${imgHtml}\n  <figcaption class="text-[11px] text-slate-500 italic mt-1">${imageCaptionInput.trim()}</figcaption>\n</figure>`;
    }
    insertSnippetAtCursor(imgHtml, '', '');
    setIsImageDialogOpen(false);
  };

  const handleInsertTemplate = (templateKey: string) => {
    if (!templateKey) return;
    let templateHtml = '';

    if (templateKey === 'weather') {
      templateHtml = `<p>Due to unplayable turf and severe weather conditions, all matches scheduled on <strong>Field 3 & Field 4</strong> are suspended for today.</p>\n\n<div class="p-3 my-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 font-medium">\n  <strong>⚠️ Status Notice:</strong> Field inspection scheduled for 1:00 PM. Rescheduled makeup kickoff times will be posted here.\n</div>\n\n<p>For urgent questions, please contact the <a href="mailto:weather@metroleague.org" class="text-emerald-700 underline font-semibold">League Weather Hotline</a>.</p>`;
    } else if (templateKey === 'closure_map') {
      templateHtml = `<p>Please be advised that <strong>North Field 1</strong> will be closed this weekend for scheduled turf rehabilitation.</p>\n\n<p><img src="https://images.unsplash.com/photo-1529900240041-22f1ad4d6391?auto=format&fit=crop&w=900&q=80" alt="Field Maintenance" class="rounded-xl max-w-full h-auto my-2 shadow-sm border border-slate-200" /></p>\n\n<p>All teams scheduled on Field 1 have been reassigned to <strong>Pitch 5 (East Complex)</strong>. View directions on the <a href="/portal" class="text-emerald-700 underline font-semibold">Coach & Parent Portal</a>.</p>`;
    } else if (templateKey === 'registration') {
      templateHtml = `<h3 class="text-base font-bold text-slate-900">Fall Tournament Registration is Now Open!</h3>\n\n<p>Team registrations are now being accepted for all U10 through U18 competitive and recreational brackets. Space is limited to 12 teams per division.</p>\n\n<p><a href="https://example.com/register" target="_blank" rel="noopener noreferrer" class="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs no-underline shadow-xs">Register Team Online Now →</a></p>\n\n<p class="text-[11px] text-slate-500">Registration deadline: Friday, November 14th at 5:00 PM.</p>`;
    } else if (templateKey === 'alert') {
      templateHtml = `<div class="p-3.5 my-2 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-950 font-medium leading-relaxed">\n  <strong class="text-rose-700 block mb-1">🚨 Urgent Referee & Coach Mandatory Meeting</strong>\n  All division coordinators and head coaches must attend the pre-match briefing at Field House Room A at 8:15 AM.\n</div>`;
    }

    if (templateHtml) {
      if (formContent.trim()) {
        if (window.confirm('Replace existing content with this template, or append to the end?\nClick OK to append, or Cancel to replace.')) {
          setFormContent((prev) => prev + '\n\n' + templateHtml);
        } else {
          setFormContent(templateHtml);
        }
      } else {
        setFormContent(templateHtml);
      }
    }
  };

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
    setEditorMode('split');
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
    setEditorMode('split');
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
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      {bulletin.title}
                    </h3>
                    {isHtmlContent(bulletin.content) && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200" title="Contains HTML formatting, links, or images">
                        <Code className="w-2.5 h-2.5" /> HTML
                      </span>
                    )}
                  </div>
                  <BulletinContent content={bulletin.content} className="mt-1.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 my-auto max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    {editingBulletin ? 'Edit Bulletin Post' : 'Post New Bulletin'}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Supports rich HTML markup, custom hyperlinks, embedded photos, and alert banners
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-900 text-xs sm:text-sm font-medium"
                  required
                />
              </div>

              {/* Category, Priority, Audience & Author */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as BulletinCategory)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
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
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important (Yellow Callout)</option>
                    <option value="urgent">Urgent (Red Alert)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Audience</label>
                  <select
                    value={formAudience}
                    onChange={(e) => setFormAudience(e.target.value as BulletinTargetAudience)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="All">All (Public & Everyone)</option>
                    <option value="Parents">Parents & Families</option>
                    <option value="Coaches">Coaches & Managers</option>
                    <option value="Referees">Match Officials</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expiration (Optional)</label>
                  <input
                    type="date"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Author & Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Author Name / Department</label>
                  <input
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="e.g., League Coordinator"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsPinned}
                      onChange={(e) => setFormIsPinned(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="font-semibold text-slate-800">Pin to top of page</span>
                  </label>

                  <span className="text-slate-300">|</span>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span className="font-semibold text-slate-800">Active (Visible)</span>
                  </label>
                </div>
              </div>

              {/* HTML Content Body with Toolbar & Multi-View Tabs */}
              <div className="space-y-1.5 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block font-semibold text-slate-800">
                    Bulletin Message Content (HTML Supported) <span className="text-rose-500">*</span>
                  </label>

                  {/* View Mode Toggle */}
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditorMode('code')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                        editorMode === 'code' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5 text-slate-600" />
                      <span>HTML Code</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('preview')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                        editorMode === 'preview' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('split')}
                      className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                        editorMode === 'split' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Columns className="w-3.5 h-3.5 text-slate-600" />
                      <span>Split View</span>
                    </button>
                  </div>
                </div>

                {/* HTML Quick Formatting Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-slate-100/90 border border-slate-300 rounded-t-lg">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertSnippetAtCursor('<strong>', '</strong>', 'bold text')}
                      className="px-2 py-1 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
                      title="Bold: <strong>...</strong>"
                    >
                      <Bold className="w-3 h-3" />
                      <span>Bold</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => insertSnippetAtCursor('<em>', '</em>', 'italic text')}
                      className="px-2 py-1 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 italic text-xs flex items-center gap-1 cursor-pointer"
                      title="Italic: <em>...</em>"
                    >
                      <Italic className="w-3 h-3" />
                      <span>Italic</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => insertSnippetAtCursor('<h3 class="text-base font-bold text-slate-900 my-1">', '</h3>', 'Section Heading')}
                      className="px-2 py-1 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
                      title="Heading: <h3>...</h3>"
                    >
                      <Heading className="w-3 h-3" />
                      <span>H3</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenLinkDialog}
                      className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                      title="Insert Hyperlink"
                    >
                      <LinkIcon className="w-3 h-3 text-emerald-600" />
                      <span>Add Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenImageDialog}
                      className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                      title="Insert Image URL"
                    >
                      <ImageIcon className="w-3 h-3 text-blue-600" />
                      <span>Add Image</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => insertSnippetAtCursor('<ul>\n  <li>', '</li>\n  <li>Second item</li>\n</ul>', 'First point')}
                      className="px-2 py-1 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs flex items-center gap-1 cursor-pointer"
                      title="Bullet List"
                    >
                      <List className="w-3 h-3" />
                      <span>List</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        insertSnippetAtCursor(
                          '<div class="p-3 my-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 font-medium">\n  <strong>⚠️ Important:</strong> ',
                          '\n</div>',
                          'Weather or schedule notice message here...'
                        )
                      }
                      className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title="Notice Callout Box"
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Callout</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        insertSnippetAtCursor(
                          '<a href="https://example.com" target="_blank" rel="noopener noreferrer" class="inline-block px-4 py-2 my-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs no-underline shadow-xs">',
                          '</a>',
                          'Action Button Label →'
                        )
                      }
                      className="px-2 py-1 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title="Call to Action Button"
                    >
                      <ExternalLink className="w-3 h-3 text-indigo-600" />
                      <span>Button</span>
                    </button>
                  </div>

                  {/* Pre-made Templates Dropdown */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Presets:</span>
                    <select
                      onChange={(e) => {
                        handleInsertTemplate(e.target.value);
                        e.target.value = '';
                      }}
                      defaultValue=""
                      className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 text-xs font-medium cursor-pointer"
                    >
                      <option value="" disabled>Insert HTML Template...</option>
                      <option value="weather">Weather Delay Advisory</option>
                      <option value="closure_map">Field Closure & Relocation Image</option>
                      <option value="registration">Cup Registration with Button</option>
                      <option value="alert">Mandatory Coach Briefing Alert</option>
                    </select>
                  </div>
                </div>

                {/* Editor Content Area (Code / Preview / Split) */}
                <div
                  className={`border border-t-0 border-slate-300 rounded-b-lg overflow-hidden bg-white ${
                    editorMode === 'split' ? 'grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200' : ''
                  }`}
                >
                  {/* Code Editor Column */}
                  {(editorMode === 'code' || editorMode === 'split') && (
                    <div className="flex flex-col h-72 sm:h-80 bg-slate-900 text-slate-100">
                      <div className="px-3 py-1 bg-slate-950 text-[10px] font-mono text-slate-400 flex items-center justify-between border-b border-slate-800">
                        <span className="flex items-center gap-1 text-slate-300 font-semibold">
                          <Code className="w-3 h-3 text-emerald-400" />
                          HTML Source Code
                        </span>
                        <span>{formContent.length} chars</span>
                      </div>
                      <textarea
                        ref={textareaRef}
                        rows={10}
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        placeholder="Type bulletin HTML markup or plain text here...\nExample: <p>Game relocated to <strong>Field 2</strong></p>"
                        className="flex-1 w-full p-3 font-mono text-xs leading-relaxed bg-transparent text-emerald-300 focus:outline-hidden resize-none selection:bg-emerald-700 selection:text-white"
                        required
                      />
                    </div>
                  )}

                  {/* Live Rendered Preview Column */}
                  {(editorMode === 'preview' || editorMode === 'split') && (
                    <div className="flex flex-col h-72 sm:h-80 bg-slate-50 overflow-hidden">
                      <div className="px-3 py-1 bg-slate-200/80 text-[10px] font-mono text-slate-600 flex items-center justify-between border-b border-slate-300 shrink-0">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Eye className="w-3 h-3 text-indigo-600" />
                          Live Card Preview (Parent & Public View)
                        </span>
                        <span className="text-[10px] uppercase font-bold text-emerald-700">Real-time</span>
                      </div>

                      <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {formIsPinned && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                <Pin className="w-2.5 h-2.5 fill-indigo-600" />
                                Pinned
                              </span>
                            )}
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {formCategory}
                            </span>
                            {formPriority === 'urgent' && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                                Urgent
                              </span>
                            )}
                            {formPriority === 'important' && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                Important
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                            {formTitle || 'Untitled Bulletin Announcement'}
                          </h4>

                          {formContent ? (
                            <div className="pt-1 border-t border-slate-100">
                              <BulletinContent content={formContent} />
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">
                              Type content on the left to see live HTML formatting, links, and photos...
                            </p>
                          )}

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                            <span>By {formAuthor || 'League Admin'}</span>
                            <span className="font-mono">{new Date().toISOString().slice(0, 10)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Formatting Tip: Use standard HTML tags like &lt;p&gt;, &lt;strong&gt;, &lt;a href="..."&gt;, &lt;img src="..."&gt;, or pick a Preset template.
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{editingBulletin ? 'Update Bulletin' : 'Publish Bulletin'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mini Helper Dialog: Insert Hyperlink */}
      {isLinkDialogOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm p-4 space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <LinkIcon className="w-4 h-4 text-emerald-600" />
                Insert Web Link
              </span>
              <button
                type="button"
                onClick={() => setIsLinkDialogOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmInsertLink} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Link URL (Web Address)</label>
                <input
                  type="url"
                  value={linkUrlInput}
                  onChange={(e) => setLinkUrlInput(e.target.value)}
                  placeholder="https://example.com/details"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-1 focus:ring-emerald-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Clickable Text Label</label>
                <input
                  type="text"
                  value={linkTextInput}
                  onChange={(e) => setLinkTextInput(e.target.value)}
                  placeholder="e.g., View Driving Directions"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={linkNewTab}
                  onChange={(e) => setLinkNewTab(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-slate-700 font-medium">Open in new window (target="_blank")</span>
              </label>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkDialogOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Insert Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mini Helper Dialog: Insert Image */}
      {isImageDialogOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm p-4 space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                Insert Image / Photo
              </span>
              <button
                type="button"
                onClick={() => setIsImageDialogOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmInsertImage} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Image Web URL (Direct Link)</label>
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://example.com/pitch_map.jpg"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-1 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alt Text (Accessibility Description)</label>
                <input
                  type="text"
                  value={imageAltInput}
                  onChange={(e) => setImageAltInput(e.target.value)}
                  placeholder="e.g., Pitch layout diagram"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Optional Caption</label>
                <input
                  type="text"
                  value={imageCaptionInput}
                  onChange={(e) => setImageCaptionInput(e.target.value)}
                  placeholder="e.g., Figure 1: North field access route"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImageDialogOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Insert Image
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
