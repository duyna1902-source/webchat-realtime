import React, { useState, useEffect } from 'react';
import { RoomDetailDto, RoomRole, UserDto } from '@webchat/shared';
import { useAuth } from '../../context/AuthContext';
import { getAvatarColorClass } from '../../utils/avatarColor';
import { readApiErrorMessage } from '../../utils/rateLimit';
import {
  X,
  Users,
  Shield,
  ShieldCheck,
  User,
  UserPlus,
  Trash2,
  LogOut,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  Search,
} from 'lucide-react';
import { apiFetch } from '../../utils/apiFetch';

interface RoomMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomDetails: RoomDetailDto | null;
  onAddMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onChangeRole: (userId: string, role: RoomRole.ADMIN | RoomRole.MEMBER) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onDeleteRoom: () => Promise<void>;
}

export const RoomMembersModal: React.FC<RoomMembersModalProps> = ({
  isOpen,
  onClose,
  roomDetails,
  onAddMember,
  onRemoveMember,
  onChangeRole,
  onLeaveRoom,
  onDeleteRoom,
}) => {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !searchQuery.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        setSearchError(null);
        const res = await apiFetch(`/api/users?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data: UserDto[] = await res.json();
          // Filter out users already in room
          const existingUserIds = new Set(roomDetails?.members.map((m) => m.userId) || []);
          setSearchResults(data.filter((u) => !existingUserIds.has(u.id)));
        } else {
          setSearchResults([]);
          setSearchError(await readApiErrorMessage(res, 'User search failed'));
        }
      } catch (err) {
        console.error('Error searching users:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser, roomDetails]);

  if (!isOpen || !roomDetails) return null;

  const currentMember = roomDetails.members.find((m) => m.userId === currentUser?.id);
  const isOwner = currentMember?.role === RoomRole.OWNER;
  const isAdmin = currentMember?.role === RoomRole.ADMIN;
  const canManageMembers = isOwner || isAdmin;

  const handleAddUser = async (userId: string) => {
    try {
      setIsAdding(true);
      setActionError(null);
      await onAddMember(userId);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      setActionError(err.message || 'Failed to add member');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      setActionLoadingId(userId);
      setActionError(null);
      await onRemoveMember(userId);
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove member');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: RoomRole.ADMIN | RoomRole.MEMBER) => {
    try {
      setActionLoadingId(userId);
      setActionError(null);
      await onChangeRole(userId, newRole);
    } catch (err: any) {
      setActionError(err.message || 'Failed to change role');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave this room?')) return;
    try {
      setActionError(null);
      await onLeaveRoom();
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Failed to leave room');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this room? This action cannot be undone.')) return;
    try {
      setActionError(null);
      await onDeleteRoom();
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete room');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full flex flex-col max-h-[90dvh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-google-blue-subtle text-google-blue flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-tight">
                {roomDetails.name} — Members
              </h3>
              <p className="text-xs text-gray-500">
                {roomDetails.members.length} {roomDetails.members.length === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {actionError && (
          <div className="m-4 p-3 bg-google-red-subtle border border-google-red/20 text-google-red text-xs rounded-xl">
            {actionError}
          </div>
        )}

        {/* Add Member Section (Owner & Admin only) */}
        {canManageMembers && (
          <div className="p-4 bg-gray-50/80 border-b border-gray-100 shrink-0">
            <span className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Invite / Add Member
            </span>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search username or email to add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-google-grey300 focus:border-google-blue focus:ring-1 focus:ring-google-blue rounded-full text-base sm:text-xs outline-none transition"
              />
            </div>

            {isSearching ? (
              <div className="py-2 flex items-center justify-center gap-2 text-xs text-google-blue mt-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Searching users...</span>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="mt-2 divide-y divide-gray-100 max-h-40 overflow-y-auto bg-white rounded-xl border border-gray-200">
                {searchResults.map((user) => (
                  <div key={user.id} className="p-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-6 h-6 rounded-full bg-google-blue-subtle text-google-blue font-semibold flex items-center justify-center text-[10px]">
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 truncate">{user.username}</span>
                      <span className="text-gray-400 truncate text-[11px]">{user.email}</span>
                    </div>
                    <button
                      onClick={() => handleAddUser(user.id)}
                      disabled={isAdding}
                      className="px-3 py-1.5 sm:py-1 bg-google-blue-subtle hover:bg-google-blue-subtle/80 text-google-blue font-medium rounded-lg text-xs transition shrink-0 flex items-center gap-1 min-h-[36px] sm:min-h-0 min-w-[40px] justify-center cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : searchError ? (
              <p role="alert" className="text-xs text-google-red py-2 text-center">
                {searchError}
              </p>
            ) : searchQuery ? (
              <p className="text-xs text-gray-400 py-2 text-center">No eligible users found</p>
            ) : null}
          </div>
        )}

        {/* Member Roster List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {roomDetails.members.map((member) => {
            const isMe = member.userId === currentUser?.id;
            const isTargetOwner = member.role === RoomRole.OWNER;
            const isTargetAdmin = member.role === RoomRole.ADMIN;
            const isTargetMember = member.role === RoomRole.MEMBER;
            const isLoading = actionLoadingId === member.userId;

            return (
              <div
                key={member.id || member.userId}
                className="p-3 bg-gray-50/60 hover:bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between gap-3 transition"
              >
                {/* Member Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full font-semibold flex items-center justify-center text-xs shrink-0 shadow-xs ${getAvatarColorClass(member.user.username)}`}>
                    {member.user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 truncate">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {member.user.username}
                      </p>
                      {isMe && (
                        <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-md font-medium">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{member.user.email}</p>
                  </div>
                </div>

                {/* Role Badge & Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Role Badge */}
                  {isTargetOwner ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-google-yellow-subtle text-google-grey900 border border-google-yellow/40">
                      <ShieldCheck className="w-3.5 h-3.5 text-google-grey900" />
                      <span>Owner</span>
                    </span>
                  ) : isTargetAdmin ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-google-blue-subtle text-google-blue border border-google-blue/30">
                      <Shield className="w-3.5 h-3.5 text-google-blue" />
                      <span>Admin</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200/60">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span>Member</span>
                    </span>
                  )}

                  {/* Owner Role Actions (Promote / Demote) */}
                  {isOwner && !isTargetOwner && (
                    <div className="flex items-center gap-1">
                      {isTargetMember ? (
                        <button
                          onClick={() => handleRoleChange(member.userId, RoomRole.ADMIN)}
                          disabled={isLoading}
                          title="Promote to Admin"
                          aria-label="Promote to Admin"
                          className="p-2 sm:p-1.5 text-gray-400 hover:text-google-blue hover:bg-google-blue-subtle rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
                        >
                          <ArrowUpCircle className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRoleChange(member.userId, RoomRole.MEMBER)}
                          disabled={isLoading}
                          title="Demote to Member"
                          aria-label="Demote to Member"
                          className="p-2 sm:p-1.5 text-gray-400 hover:text-google-yellow hover:bg-google-yellow-subtle rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
                        >
                          <ArrowDownCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Remove Button */}
                  {/* Owner can remove anyone except themselves */}
                  {/* Admin can remove regular members */}
                  {((isOwner && !isTargetOwner) || (isAdmin && isTargetMember)) && (
                    <button
                      onClick={() => handleRemove(member.userId)}
                      disabled={isLoading}
                      title="Remove Member"
                      aria-label="Remove Member"
                      className="p-2 sm:p-1.5 text-gray-400 hover:text-google-red hover:bg-google-red-subtle rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          {isOwner ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-google-red hover:bg-google-red-subtle rounded-xl transition cursor-pointer min-h-[40px]"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Room</span>
            </button>
          ) : (
            <button
              onClick={handleLeave}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-google-red hover:bg-google-red-subtle rounded-xl transition cursor-pointer min-h-[40px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave Room</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition min-h-[40px] flex items-center justify-center cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
