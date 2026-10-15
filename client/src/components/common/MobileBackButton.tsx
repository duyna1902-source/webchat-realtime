import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface MobileBackButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export const MobileBackButton: React.FC<MobileBackButtonProps> = ({
  onClick,
  label = 'Chats',
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Back to ${label.toLowerCase()}`}
      className={`md:hidden -ml-1.5 px-2 py-1.5 rounded-xl text-gray-700 hover:text-indigo-600 hover:bg-gray-100 active:bg-gray-200 transition flex items-center gap-1 min-w-[40px] min-h-[40px] justify-center cursor-pointer ${className}`}
    >
      <ChevronLeft className="w-5 h-5 text-gray-700 shrink-0" />
      <span className="text-xs font-semibold text-gray-700">{label}</span>
    </button>
  );
};
