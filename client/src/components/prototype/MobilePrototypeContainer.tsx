import React, { useState, useEffect } from 'react';
import { PrototypeSwitcher } from './PrototypeSwitcher';
import { VariantA_MasterDetail } from './VariantA_MasterDetail';
import { VariantB_BottomNav } from './VariantB_BottomNav';
import { VariantC_SlideDrawer } from './VariantC_SlideDrawer';

export const PROTOTYPE_VARIANTS = [
  { key: 'A', name: 'Master-Detail (WhatsApp/Telegram)' },
  { key: 'B', name: 'Bottom Navigation (Slack/Instagram)' },
  { key: 'C', name: 'Slide Drawer (Discord/Modern)' },
];

export const MobilePrototypeContainer: React.FC = () => {
  // Read initial variant from ?variant=A | B | C
  const [currentVariant, setCurrentVariant] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('variant');
      if (p && ['A', 'B', 'C'].includes(p.toUpperCase())) {
        return p.toUpperCase();
      }
    }
    return 'A';
  });

  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(true);

  const handleSelectVariant = (key: string) => {
    setCurrentVariant(key);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('variant', key);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleExitPrototype = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('variant');
      url.searchParams.delete('prototype');
      window.location.href = url.pathname;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-0 md:p-6 overflow-hidden select-none">
      {/* Phone Mockup Frame or Full Width Container */}
      <div
        className={
          isPhoneFrame
            ? 'w-full md:w-[390px] h-[100dvh] md:h-[820px] bg-black md:rounded-[44px] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] md:border-[10px] md:border-slate-800 flex flex-col overflow-hidden relative transition-all duration-300'
            : 'w-full h-[100dvh] flex flex-col overflow-hidden bg-white'
        }
      >
        {/* Simulated Phone Notch / Dynamic Island on Frame mode */}
        {isPhoneFrame && (
          <div className="hidden md:flex justify-center pt-2 pb-1 bg-black shrink-0 z-30">
            <div className="w-24 h-4.5 bg-slate-900 rounded-full" />
          </div>
        )}

        {/* Content Rendered per Variant */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {currentVariant === 'A' && <VariantA_MasterDetail />}
          {currentVariant === 'B' && <VariantB_BottomNav />}
          {currentVariant === 'C' && <VariantC_SlideDrawer />}
        </div>

        {/* Simulated iPhone Home Indicator Bar */}
        {isPhoneFrame && (
          <div className="hidden md:flex justify-center pb-2 pt-1 bg-black shrink-0">
            <div className="w-32 h-1 bg-slate-700 rounded-full" />
          </div>
        )}
      </div>

      {/* Floating Bottom Switcher Tool */}
      <PrototypeSwitcher
        variants={PROTOTYPE_VARIANTS}
        currentVariant={currentVariant}
        onSelectVariant={handleSelectVariant}
        isPhoneFrame={isPhoneFrame}
        onTogglePhoneFrame={() => setIsPhoneFrame(!isPhoneFrame)}
        onExitPrototype={handleExitPrototype}
      />
    </div>
  );
};
