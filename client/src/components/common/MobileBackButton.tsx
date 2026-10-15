import React from 'react';
import { ArrowLeft } from 'lucide-react';

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
      title={`Back to ${label.toLowerCase()}`}
      data-testid="mobile-back-button"
      className={`md:hidden -ml-1.5 p-1.5 rounded-full text-google-grey700 hover:text-google-grey900 hover:bg-google-grey100 active:bg-google-grey200 transition flex items-center gap-1 min-w-[36px] min-h-[36px] justify-center cursor-pointer ${className}`}
    >
      <ArrowLeft className="w-5 h-5 text-google-grey900 shrink-0" aria-hidden="true" />
      <span className="text-xs font-semibold text-google-grey700 hidden sm:inline">{label}</span>
      <span className="sr-only">Back to {label}</span>
    </button>
  );
};
