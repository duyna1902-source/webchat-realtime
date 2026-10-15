import React, { useEffect } from 'react';

export interface PrototypeSwitcherProps {
  variants: { key: string; name: string }[];
  currentVariant: string;
  onSelectVariant: (key: string) => void;
  isPhoneFrame: boolean;
  onTogglePhoneFrame: () => void;
  onExitPrototype: () => void;
}

export const PrototypeSwitcher: React.FC<PrototypeSwitcherProps> = ({
  variants,
  currentVariant,
  onSelectVariant,
  isPhoneFrame,
  onTogglePhoneFrame,
  onExitPrototype,
}) => {
  const currentIndex = Math.max(
    0,
    variants.findIndex((v) => v.key === currentVariant)
  );

  const prevVariant = () => {
    const nextIndex = (currentIndex - 1 + variants.length) % variants.length;
    onSelectVariant(variants[nextIndex].key);
  };

  const nextVariant = () => {
    const nextIndex = (currentIndex + 1) % variants.length;
    onSelectVariant(variants[nextIndex].key);
  };

  // Keyboard navigation with arrow keys (when not typing in an input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevVariant();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextVariant();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, variants]);

  const current = variants[currentIndex] || variants[0];

  return (
    <aside
      aria-label="Prototype Switcher Toolbar"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900/95 text-white backdrop-blur-md px-3 py-2 rounded-2xl shadow-2xl border border-gray-700/80 text-xs select-none max-w-[95vw]"
    >
      {/* Exit Button */}
      <button
        onClick={onExitPrototype}
        className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition cursor-pointer text-[11px]"
        title="Exit Prototype"
      >
        ✕ Exit
      </button>

      <div className="h-4 w-px bg-gray-700" />

      {/* Prev Arrow */}
      <button
        onClick={prevVariant}
        className="p-1 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition cursor-pointer"
        title="Previous variant (Left arrow key)"
        aria-label="Previous variant"
      >
        ◀
      </button>

      {/* Variant Selector Pills */}
      <div className="flex items-center gap-1.5 px-1">
        {variants.map((v) => (
          <button
            key={v.key}
            onClick={() => onSelectVariant(v.key)}
            className={`px-2.5 py-1 rounded-xl font-medium transition cursor-pointer ${
              v.key === currentVariant
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            <span className="font-bold mr-1">{v.key}:</span>
            <span className="hidden sm:inline">{v.name}</span>
          </button>
        ))}
      </div>

      {/* Next Arrow */}
      <button
        onClick={nextVariant}
        className="p-1 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition cursor-pointer"
        title="Next variant (Right arrow key)"
        aria-label="Next variant"
      >
        ▶
      </button>

      <div className="h-4 w-px bg-gray-700 hidden md:block" />

      {/* Phone Frame Toggle (Desktop only) */}
      <button
        onClick={onTogglePhoneFrame}
        className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-indigo-300 transition cursor-pointer text-[11px]"
        title="Toggle phone frame simulator"
      >
        <span>{isPhoneFrame ? '📱 Phone Shell (390px)' : '🖥️ Full Width'}</span>
      </button>
    </aside>
  );
};
