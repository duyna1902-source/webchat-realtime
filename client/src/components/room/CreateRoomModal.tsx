import React, { useState } from 'react';
import { X, Hash, Loader2 } from 'lucide-react';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (name: string, description?: string) => Promise<string>;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreateRoom,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Room name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onCreateRoom(name.trim(), description.trim() || undefined);
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-google-blue-subtle text-google-blue flex items-center justify-center">
              <Hash className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Create New Room</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="room-name" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Room Name *
            </label>
            <input
              id="room-name"
              type="text"
              placeholder="e.g. engineering-team, general"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 bg-gray-50 focus:bg-white border border-gray-200 focus:border-google-blue rounded-xl text-base sm:text-sm outline-none transition"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="room-desc" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              id="room-desc"
              rows={2}
              placeholder="What is this room about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2 bg-gray-50 focus:bg-white border border-gray-200 focus:border-google-blue rounded-xl text-base sm:text-sm outline-none transition resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition min-h-[40px] flex items-center justify-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 bg-google-blue hover:bg-google-blue-hover disabled:opacity-50 text-white text-sm font-medium rounded-xl transition flex items-center gap-2 shadow-sm min-h-[40px] cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Create Room</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
