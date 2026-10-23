import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import type { SelfUserDto } from '@webchat/shared';
import { getAvatarColorClass } from '../../utils/avatarColor';

interface AccountInfoModalProps {
  /** The signed-in User; the only place the client shows its own email. */
  user: SelfUserDto;
  isOpen: boolean;
  onClose: () => void;
}

export const AccountInfoModal: React.FC<AccountInfoModalProps> = ({ user, isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="account-info-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-info-title"
        className="relative w-full max-w-sm flex flex-col items-center gap-3 bg-white p-8 rounded-2xl shadow-md text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-google-grey700 hover:bg-google-grey100 transition cursor-pointer"
          title="Close"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 id="account-info-title" className="font-semibold text-google-blue text-lg">
          Account Info
        </h2>
        <div
          className={`w-20 h-20 rounded-full ${getAvatarColorClass(user.username)} text-[35px] font-bold flex items-center justify-center shadow-xs shrink-0`}
          aria-hidden="true"
        >
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <p className="font-bold text-2xl text-google-grey900 [overflow-wrap:anywhere]">{user.username}</p>
        <p className="text-sm text-google-grey900 [overflow-wrap:anywhere]">
          Email: <i>{user.email}</i>
        </p>
        <p className="text-sm text-google-grey900">
          Account created: <i>{new Date(user.createdAt).toLocaleDateString()}</i>
        </p>
      </div>
    </div>
  );
};
