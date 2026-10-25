import React, { useState, useEffect } from 'react';
import {
  Users,
  X,
  UserPlus,
  Key,
  Shield,
  ShieldAlert,
  Database,
  Check,
  AlertCircle,
  Clock,
  RefreshCw,
  Trash2,
  Edit3,
  AlertTriangle,
  Save,
} from 'lucide-react';
import {
  AdminUser,
  listAdminUsers,
  createAdminUser,
  changeAdminPassword,
  deleteAdminUserApi,
  updateAdminUserApi,
} from '../../utils/authClient';

interface AdminUsersModalProps {
  currentUser: AdminUser;
  onClose: () => void;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  currentUser,
  onClose,
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveMySql, setIsLiveMySql] = useState(true);

  // Add User Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'scheduler' | 'viewer' | 'superadmin'>('admin');

  // Edit User State
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<'superadmin' | 'admin' | 'scheduler' | 'viewer'>('admin');

  // Change Password State
  const [passwordTargetUser, setPasswordTargetUser] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Delete User Confirmation State
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);

  // Messages
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await listAdminUsers();
      setUsers(res.users);
      setIsLiveMySql(res.isLiveMySql);
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser.role === 'superadmin') {
      fetchUsers();
    }
  }, [currentUser.role]);

  if (currentUser.role !== 'superadmin') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Superadmin Access Required</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              User login and role administration is restricted exclusively to <strong>Super Administrator</strong> accounts.
            </p>
            <p className="text-xs text-slate-600 mt-2">
              Your current account role: <span className="font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{currentUser.role}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await createAdminUser({
        username: newUsername.trim(),
        password: newPassword,
        displayName: newDisplayName.trim() || newUsername.trim(),
        role: newRole,
      });

      if (res.success) {
        setStatusMessage({ text: res.message, type: 'success' });
        setIsAdding(false);
        setNewUsername('');
        setNewPassword('');
        setNewDisplayName('');
        await fetchUsers();
      } else {
        setStatusMessage({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await updateAdminUserApi(editingUser.username, {
        displayName: editDisplayName.trim() || editingUser.username,
        role: editRole,
      });

      if (res.success) {
        setStatusMessage({ text: res.message, type: 'success' });
        setEditingUser(null);
        await fetchUsers();
      } else {
        setStatusMessage({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await deleteAdminUserApi(username);
      if (res.success) {
        setStatusMessage({ text: res.message, type: 'success' });
        setConfirmDeleteUser(null);
        await fetchUsers();
      } else {
        setStatusMessage({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser || !newPasswordInput) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await changeAdminPassword(newPasswordInput, passwordTargetUser);
      if (res.success) {
        setStatusMessage({ text: `Password updated for "${passwordTargetUser}".`, type: 'success' });
        setPasswordTargetUser(null);
        setNewPasswordInput('');
      } else {
        setStatusMessage({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'scheduler':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                MySQL Admin Users & Access Control
              </h3>
              <p className="text-[11px] text-slate-500">
                Credentials and permissions stored in MySQL table: <code className="font-mono font-bold text-indigo-700">admin_users</code>
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <span>{statusMessage.text}</span>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="font-bold p-1 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
          )}

          {/* Database Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <span className="text-slate-700 font-medium text-xs">
                {isLiveMySql ? 'MySQL Live Database Table Connected' : 'Embedded Admin Users Storage'}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchUsers}
              disabled={isLoading}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg border border-slate-300 bg-white shadow-2xs cursor-pointer"
              title="Refresh list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Users List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pt-1">
              <h4 className="font-bold text-slate-900 text-xs">
                Registered Administrators ({users.length})
              </h4>
              {!isAdding && !editingUser && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(true);
                    setEditingUser(null);
                    setPasswordTargetUser(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Admin User</span>
                </button>
              )}
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">Display Name</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Last Login</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isSelf = u.username.toLowerCase() === currentUser.username.toLowerCase();
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {u.username}
                          {isSelf && (
                            <span className="ml-1.5 px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[10px] rounded-full font-sans">
                              You
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{u.displayName}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getRoleBadge(
                              u.role
                            )}`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUser(u);
                                setEditDisplayName(u.displayName);
                                setEditRole(u.role as any);
                                setIsAdding(false);
                                setPasswordTargetUser(null);
                              }}
                              className="p-1 rounded-md text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              title="Edit user role & name"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPasswordTargetUser(u.username);
                                setNewPasswordInput('');
                                setEditingUser(null);
                                setIsAdding(false);
                              }}
                              className="p-1 rounded-md text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                              title="Reset password"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isSelf || users.length <= 1}
                              onClick={() => setConfirmDeleteUser(u.username)}
                              className={`p-1 rounded-md transition-colors ${
                                isSelf || users.length <= 1
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                              }`}
                              title={
                                isSelf
                                  ? 'Cannot delete your active logged-in user'
                                  : users.length <= 1
                                  ? 'Cannot delete the only administrator'
                                  : 'Delete user'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit User Form */}
          {editingUser && (
            <form
              onSubmit={handleUpdateUser}
              className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-indigo-600" />
                  <span>
                    Edit Administrator: <strong className="font-mono text-indigo-900">@{editingUser.username}</strong>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="text-slate-400 hover:text-slate-700 text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="e.g. Steve Ward"
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Role & Permissions
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="superadmin">Super Admin (Full DB & User Admin)</option>
                    <option value="admin">Admin (Full Schedule & DB Sync)</option>
                    <option value="scheduler">Scheduler (Edit Schedule)</option>
                    <option value="viewer">Viewer (Read Only)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          )}

          {/* Add User Modal / Inline Form */}
          {isAdding && (
            <form onSubmit={handleCreateUser} className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  <span>Create New MySQL Administrator</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-slate-400 hover:text-slate-700 text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. coach_steve"
                    className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="e.g. Steve Ward"
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="superadmin">Super Admin (Full DB & User Admin)</option>
                    <option value="admin">Admin (Full Access)</option>
                    <option value="scheduler">Scheduler (Edit Schedule)</option>
                    <option value="viewer">Viewer (Read Only)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  Save User to MySQL
                </button>
              </div>
            </form>
          )}

          {/* Change Password Dialog */}
          {passwordTargetUser && (
            <form onSubmit={handleChangePassword} className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-700" />
                  <span>Update Password for: <strong className="font-mono text-indigo-900">{passwordTargetUser}</strong></span>
                </span>
                <button
                  type="button"
                  onClick={() => setPasswordTargetUser(null)}
                  className="text-slate-400 hover:text-slate-700 text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  required
                  autoFocus
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password (min 4 characters)"
                  className="flex-1 text-xs font-mono p-2 rounded-lg border border-slate-300 bg-white"
                />
                <button
                  type="submit"
                  disabled={isLoading || newPasswordInput.length < 4}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                >
                  Update Password
                </button>
              </div>
            </form>
          )}

          {/* Delete User Confirmation Dialog */}
          {confirmDeleteUser && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h5 className="font-bold text-rose-900 text-xs">
                    Confirm Deleting User "@{confirmDeleteUser}"
                  </h5>
                  <p className="text-[11px] text-rose-700">
                    Are you sure you want to permanently remove this user from the MySQL <code className="font-mono">admin_users</code> table? This user will immediately lose all administrative access.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteUser(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteUser(confirmDeleteUser)}
                  disabled={isLoading}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete User</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
