import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { AppData, GoogleDriveSyncInfo } from '../../types';
import {
  googleDriveSignIn,
  googleDriveSignOut,
  getDriveAccessToken,
  initDriveAuth,
  getCurrentDriveUser,
} from '../../utils/googleDriveAuth';
import {
  listSharedDrives,
  listDriveFiles,
  getDriveFileContent,
  createDriveFile,
  updateDriveFile,
  checkForRemoteConflict,
  SharedDriveItem,
  DriveFileItem,
} from '../../utils/googleDriveApi';
import { ConflictMergeModal } from './ConflictMergeModal';
import {
  X,
  Cloud,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  Save,
  Plus,
  Search,
  AlertTriangle,
  LogOut,
  HardDrive,
  FileJson,
  ExternalLink,
  ShieldCheck,
  Clock,
  User as UserIcon,
  HelpCircle,
  Unlink,
} from 'lucide-react';

interface GoogleDriveSyncModalProps {
  appData: AppData;
  onUpdateAppData: (newData: AppData) => void;
  onClose: () => void;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  appData,
  onUpdateAppData,
  onClose,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentDriveUser());
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Drive Browsing State
  const [sharedDrives, setSharedDrives] = useState<SharedDriveItem[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState<string>('my_drive'); // 'my_drive' or Shared Drive ID
  const [filesList, setFilesList] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Operations state
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error' | 'warning';
  } | null>(null);

  // Save As New File form state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newFileNameInput, setNewFileNameInput] = useState(
    appData.fileName || 'league_schedule.json'
  );

  // Destructive Confirmation Modal state (Mandatory per Workspace Skill)
  const [pendingConfirmAction, setPendingConfirmAction] = useState<{
    title: string;
    description: string;
    confirmText: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Concurrency Conflict state
  const [activeConflict, setActiveConflict] = useState<{
    remoteData: AppData;
    remoteModifier?: string;
    remoteModifiedTime?: string;
  } | null>(null);

  // Active sync info from AppData
  const linkedSync = appData.googleDriveSync;

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = initDriveAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );

    // Initial check for cached token
    getDriveAccessToken().then((tok) => {
      if (tok) {
        setAccessToken(tok);
        setCurrentUser(getCurrentDriveUser());
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch Shared Drives and File list when user is authenticated
  const loadDrivesAndFiles = useCallback(async (token: string, driveId?: string) => {
    setIsLoadingFiles(true);
    setStatusMessage(null);
    try {
      // 1. Fetch Shared Drives
      const drives = await listSharedDrives(token);
      setSharedDrives(drives);

      // 2. Fetch Files
      const targetDrive = driveId && driveId !== 'my_drive' ? driveId : undefined;
      const files = await listDriveFiles(token, { driveId: targetDrive, searchQuery });
      setFilesList(files);
    } catch (err: any) {
      console.error('Failed to load drive files:', err);
      setStatusMessage({
        text: `Error accessing Google Drive: ${err.message || 'Check your permissions.'}`,
        type: 'error',
      });
    } finally {
      setIsLoadingFiles(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (accessToken) {
      loadDrivesAndFiles(accessToken, selectedDriveId);
    }
  }, [accessToken, selectedDriveId, loadDrivesAndFiles]);

  // Handle Google Sign In
  const handleSignIn = async () => {
    setIsSigningIn(true);
    setStatusMessage(null);
    try {
      const { user, accessToken: token } = await googleDriveSignIn();
      setCurrentUser(user);
      setAccessToken(token);
      setStatusMessage({
        text: `Signed in as ${user.displayName || user.email}. Connected to Google Drive.`,
        type: 'success',
      });
      loadDrivesAndFiles(token, selectedDriveId);
    } catch (err: any) {
      console.error('Sign in failed:', err);
      setStatusMessage({
        text: `Google sign-in error: ${err.message || 'Failed to authenticate.'}`,
        type: 'error',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      await googleDriveSignOut();
      setCurrentUser(null);
      setAccessToken(null);
      setFilesList([]);
      setSharedDrives([]);
      setStatusMessage({ text: 'Signed out of Google Drive.', type: 'info' });
    } catch (err: any) {
      setStatusMessage({ text: `Sign out failed: ${err.message}`, type: 'error' });
    }
  };

  // -------------------------------------------------------------
  // SAVE TO CURRENT GOOGLE DRIVE FILE (WITH CONFLICT DETECTION)
  // -------------------------------------------------------------
  const handleSaveToDrive = async () => {
    if (!accessToken || !linkedSync) return;

    // Check for remote conflict first
    setIsSyncing(true);
    setStatusMessage({ text: 'Checking for concurrent edits on Google Drive...', type: 'info' });

    try {
      const conflictCheck = await checkForRemoteConflict(accessToken, linkedSync.fileId, linkedSync);

      if (conflictCheck.hasConflict && conflictCheck.remoteData) {
        setIsSyncing(false);
        setActiveConflict({
          remoteData: conflictCheck.remoteData,
          remoteModifier: conflictCheck.remoteLastModifiedBy,
          remoteModifiedTime: conflictCheck.remoteMeta.modifiedTime,
        });
        return;
      }

      // No conflict detected: prompt confirmation before mutating file (MANDATORY per skill)
      setPendingConfirmAction({
        title: 'Save to Google Drive?',
        description: `This will update the contents of "${linkedSync.fileName}" in Google Drive with your latest changes. Collaborators will receive this update on their next sync.`,
        confirmText: 'Save to Drive',
        onConfirm: async () => {
          setIsSyncing(true);
          try {
            const { appData: updatedData } = await updateDriveFile(
              accessToken,
              linkedSync.fileId,
              appData,
              { userName: currentUser?.displayName || currentUser?.email || 'Admin' }
            );

            onUpdateAppData(updatedData);
            setStatusMessage({
              text: `Successfully saved changes to "${linkedSync.fileName}" on Google Drive!`,
              type: 'success',
            });
            loadDrivesAndFiles(accessToken, selectedDriveId);
          } catch (err: any) {
            setStatusMessage({
              text: `Failed to save to Google Drive: ${err.message}`,
              type: 'error',
            });
          } finally {
            setIsSyncing(false);
          }
        },
      });
    } catch (err: any) {
      setStatusMessage({
        text: `Error verifying file status: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // -------------------------------------------------------------
  // CHECK FOR REMOTE UPDATES (MANUAL POLL)
  // -------------------------------------------------------------
  const handleCheckRemoteUpdates = async () => {
    if (!accessToken || !linkedSync) return;

    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const conflictCheck = await checkForRemoteConflict(accessToken, linkedSync.fileId, linkedSync);

      if (conflictCheck.hasConflict && conflictCheck.remoteData) {
        setActiveConflict({
          remoteData: conflictCheck.remoteData,
          remoteModifier: conflictCheck.remoteLastModifiedBy,
          remoteModifiedTime: conflictCheck.remoteMeta.modifiedTime,
        });
      } else {
        setStatusMessage({
          text: `Your local schedule is fully up to date with Google Drive. No remote changes detected.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Failed to check for remote changes: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // -------------------------------------------------------------
  // RETRIEVE / LOAD SCHEDULE FROM GOOGLE DRIVE FILE
  // -------------------------------------------------------------
  const handleLoadFileFromDrive = (file: DriveFileItem) => {
    if (!accessToken) return;

    setPendingConfirmAction({
      title: `Load schedule from Google Drive?`,
      description: `This will load "${file.name}" from Google Drive into PitchMaster. Any unsaved changes in your current session will be replaced.`,
      confirmText: 'Load File',
      onConfirm: async () => {
        setIsSyncing(true);
        setStatusMessage(null);
        try {
          const { appData: loadedData } = await getDriveFileContent(accessToken, file.id);
          onUpdateAppData(loadedData);
          setStatusMessage({
            text: `Successfully loaded "${file.name}" from Google Drive!`,
            type: 'success',
          });
        } catch (err: any) {
          setStatusMessage({
            text: `Failed to load file from Google Drive: ${err.message}`,
            type: 'error',
          });
        } finally {
          setIsSyncing(false);
        }
      },
    });
  };

  // -------------------------------------------------------------
  // SAVE AS NEW FILE IN GOOGLE DRIVE OR SHARED DRIVE
  // -------------------------------------------------------------
  const handleCreateNewFile = async () => {
    if (!accessToken) return;

    const cleanName = newFileNameInput.trim();
    if (!cleanName) {
      setStatusMessage({ text: 'Please enter a valid file name.', type: 'error' });
      return;
    }

    const targetDrive = selectedDriveId !== 'my_drive' ? selectedDriveId : undefined;
    const driveName =
      selectedDriveId !== 'my_drive'
        ? sharedDrives.find((d) => d.id === selectedDriveId)?.name
        : 'My Drive';

    setPendingConfirmAction({
      title: `Save as New File in ${driveName}?`,
      description: `This will create a new schedule JSON file named "${cleanName}" in ${driveName} and link PitchMaster to it.`,
      confirmText: 'Create & Link File',
      onConfirm: async () => {
        setIsSyncing(true);
        setStatusMessage(null);
        try {
          const { appData: createdData } = await createDriveFile(
            accessToken,
            appData,
            cleanName,
            {
              driveId: targetDrive,
              userName: currentUser?.displayName || currentUser?.email || 'Admin',
            }
          );

          onUpdateAppData(createdData);
          setIsCreatingNew(false);
          setStatusMessage({
            text: `Successfully created and linked "${cleanName}" in ${driveName}!`,
            type: 'success',
          });
          loadDrivesAndFiles(accessToken, selectedDriveId);
        } catch (err: any) {
          setStatusMessage({
            text: `Failed to create file in Google Drive: ${err.message}`,
            type: 'error',
          });
        } finally {
          setIsSyncing(false);
        }
      },
    });
  };

  // -------------------------------------------------------------
  // DISCONNECT LINKED FILE
  // -------------------------------------------------------------
  const handleUnlink = () => {
    const unlinkedData: AppData = {
      ...appData,
      googleDriveSync: undefined,
    };
    onUpdateAppData(unlinkedData);
    setStatusMessage({
      text: 'Unlinked from Google Drive file. Data remains saved locally.',
      type: 'info',
    });
  };

  // -------------------------------------------------------------
  // HANDLE MERGE RESOLUTION
  // -------------------------------------------------------------
  const handleApplyMerge = async (
    mergedData: AppData,
    strategy: 'smart' | 'overwrite_remote' | 'accept_remote'
  ) => {
    if (!accessToken || !linkedSync) return;
    setActiveConflict(null);
    setIsSyncing(true);

    try {
      if (strategy === 'accept_remote') {
        onUpdateAppData(mergedData);
        setStatusMessage({
          text: 'Loaded the latest version from Google Drive successfully.',
          type: 'success',
        });
      } else {
        // Smart merge or overwrite remote: Save the merged version back to Drive
        const { appData: savedData } = await updateDriveFile(
          accessToken,
          linkedSync.fileId,
          mergedData,
          { userName: currentUser?.displayName || currentUser?.email || 'Admin' }
        );

        onUpdateAppData(savedData);
        setStatusMessage({
          text:
            strategy === 'smart'
              ? 'Smart merge applied! Unified changes successfully saved to Google Drive.'
              : 'Remote file in Google Drive successfully overwritten with your changes.',
          type: 'success',
        });
        loadDrivesAndFiles(accessToken, selectedDriveId);
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Failed to apply merge to Google Drive: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Google Drive & Shared Drive Synchronization
                </h3>
                <p className="text-[11px] text-slate-500">
                  Store, retrieve, and multi-user sync schedule data in Google Drive
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
            {/* Status Feedback Message */}
            {statusMessage && (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs animate-in fade-in ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : statusMessage.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : statusMessage.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                <span>{statusMessage.text}</span>
                <button
                  type="button"
                  onClick={() => setStatusMessage(null)}
                  className="p-0.5 text-slate-400 hover:text-slate-700 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* SECTION 1: AUTHENTICATION */}
            {!currentUser ? (
              <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50/70 text-center space-y-4">
                <div className="max-w-md mx-auto space-y-1.5">
                  <h4 className="font-bold text-slate-900 text-sm">
                    Connect Your Google Account
                  </h4>
                  <p className="text-slate-500 text-xs">
                    Sign in to access your Google Drive and Shared Drives. You can store your schedule JSON files, share them with fellow league organizers, and detect concurrent edits.
                  </p>
                </div>

                {/* Official Material Design "Sign in with Google" button */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    className="inline-flex items-center gap-3 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 rounded-xl shadow-xs transition-colors hover:shadow-sm disabled:opacity-60"
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
                      viewBox="0 0 48 48"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                    <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl">
                <div className="flex items-center gap-3">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Google User'}
                      className="w-8 h-8 rounded-full border border-blue-200 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'G'}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>{currentUser.displayName || 'Google Account'}</span>
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full font-medium">
                        Connected
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">{currentUser.email}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            {/* SECTION 2: CURRENTLY LINKED GOOGLE DRIVE FILE */}
            {currentUser && linkedSync && (
              <div className="p-4 border-2 border-emerald-500/30 bg-emerald-50/40 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">
                          {linkedSync.fileName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Active Sync
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block">
                        Location: {linkedSync.driveName || 'My Drive'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCheckRemoteUpdates}
                      disabled={isSyncing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-2xs disabled:opacity-60"
                      title="Verify if any collaborator modified this file"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Check Updates</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveToDrive}
                      disabled={isSyncing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-60"
                      title="Push your latest changes to Google Drive"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save to Drive</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleUnlink}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Unlink file connection"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Metadata & Timestamp Indicators */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-[11px] text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Last Synced:</span>
                    <span className="font-mono">
                      {new Date(linkedSync.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Revision Token:</span>
                    <span className="font-mono truncate block" title={linkedSync.syncToken}>
                      {linkedSync.syncToken.substring(0, 16)}...
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Last Modifier:</span>
                    <span className="truncate block">{linkedSync.lastModifiedBy || 'You'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: DRIVE SOURCE (MY DRIVE VS SHARED DRIVES) */}
            {currentUser && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Drive Selector */}
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
                    <select
                      value={selectedDriveId}
                      onChange={(e) => setSelectedDriveId(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="my_drive">📁 My Drive</option>
                      {sharedDrives.map((sd) => (
                        <option key={sd.id} value={sd.id}>
                          👥 Shared Drive: {sd.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => accessToken && loadDrivesAndFiles(accessToken, selectedDriveId)}
                      disabled={isLoadingFiles}
                      className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Refresh file list"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {/* Actions: Save As New */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(!isCreatingNew)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Save as New File</span>
                    </button>
                  </div>
                </div>

                {/* Form to Save as New File */}
                {isCreatingNew && (
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3 animate-in fade-in">
                    <span className="font-bold text-slate-900 text-xs block">
                      Save Schedule as New File in {selectedDriveId === 'my_drive' ? 'My Drive' : 'Selected Shared Drive'}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="league_schedule.json"
                        value={newFileNameInput}
                        onChange={(e) => setNewFileNameInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleCreateNewFile}
                        disabled={isSyncing}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-60"
                      >
                        Create & Connect
                      </button>
                    </div>
                  </div>
                )}

                {/* Search Bar & File Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                      Schedule JSON Files in {selectedDriveId === 'my_drive' ? 'My Drive' : 'Shared Drive'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {filesList.length} file(s) found
                    </span>
                  </div>

                  {isLoadingFiles ? (
                    <div className="py-12 text-center text-slate-400 space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      <p>Searching Google Drive for schedule JSON files...</p>
                    </div>
                  ) : filesList.length === 0 ? (
                    <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 space-y-2">
                      <FileJson className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-slate-500 text-xs">
                        No JSON files found in this location.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsCreatingNew(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save current schedule here</span>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 text-[11px] font-semibold sticky top-0">
                          <tr>
                            <th className="px-3.5 py-2">File Name</th>
                            <th className="px-3.5 py-2">Modified</th>
                            <th className="px-3.5 py-2">Last Editor</th>
                            <th className="px-3.5 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filesList.map((file) => {
                            const isCurrentlyLinked = linkedSync?.fileId === file.id;
                            const formattedDate = new Date(file.modifiedTime).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            });

                            return (
                              <tr key={file.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-3.5 py-2.5 font-medium text-slate-900">
                                  <div className="flex items-center gap-2">
                                    <FileJson className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span className="truncate max-w-[180px]">{file.name}</span>
                                    {isCurrentlyLinked && (
                                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-semibold rounded-full">
                                        Current
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3.5 py-2.5 text-slate-500 font-mono text-[11px]">
                                  {formattedDate}
                                </td>
                                <td className="px-3.5 py-2.5 text-slate-500 text-[11px] truncate max-w-[120px]">
                                  {file.lastModifyingUser?.displayName ||
                                    file.lastModifyingUser?.emailAddress ||
                                    'Unknown'}
                                </td>
                                <td className="px-3.5 py-2.5 text-right space-x-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleLoadFileFromDrive(file)}
                                    disabled={isSyncing}
                                    className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[11px] font-semibold transition-colors disabled:opacity-60"
                                    title="Open and load this schedule into PitchMaster"
                                  >
                                    Load
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Token-based concurrency protection active</span>
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL FOR DESTRUCTIVE / OVERWRITE OPERATIONS */}
      {pendingConfirmAction && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 border border-slate-200">
            <div className="flex items-center gap-3 text-slate-900">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">{pendingConfirmAction.title}</h3>
                <p className="text-xs text-slate-500">Google Drive Confirmation</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {pendingConfirmAction.description}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingConfirmAction(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = pendingConfirmAction.onConfirm;
                  setPendingConfirmAction(null);
                  await action();
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-xs"
              >
                {pendingConfirmAction.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONCURRENCY CONFLICT & MERGE MODAL */}
      {activeConflict && (
        <ConflictMergeModal
          localData={appData}
          remoteData={activeConflict.remoteData}
          remoteModifier={activeConflict.remoteModifier}
          remoteModifiedTime={activeConflict.remoteModifiedTime}
          onApplyMerge={handleApplyMerge}
          onClose={() => setActiveConflict(null)}
        />
      )}
    </>
  );
};
