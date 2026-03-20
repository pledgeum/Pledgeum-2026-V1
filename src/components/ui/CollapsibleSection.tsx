'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  storageKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function CollapsibleSection({
  title,
  icon,
  storageKey,
  defaultOpen = true,
  children,
  onMoveUp,
  onMoveDown
}: CollapsibleSectionProps) {
  // 🛡️ SSR Safe initialization: Only use props during first render
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [isMounted, setIsMounted] = useState(false);

  // 🛟 Post-mount hydration: Sync from LocalStorage only once mounted on client
  useEffect(() => {
    setIsMounted(true);
    
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored !== null) {
        setIsOpen(stored === 'true');
      }
    } catch (error) {
      // Fail-safe: Safari in private mode or blocked storage
      console.warn(`[CollapsibleSection] Failed to read from localStorage for key: ${storageKey}`, error);
    }
  }, [storageKey]);

  // 💾 State persistence: Sync to LocalStorage on changes
  useEffect(() => {
    // Only persist if mounted to avoid server-side errors
    if (!isMounted) return;

    try {
      window.localStorage.setItem(storageKey, String(isOpen));
    } catch (error) {
      console.warn(`[CollapsibleSection] Failed to write to localStorage for key: ${storageKey}`, error);
    }
  }, [isOpen, storageKey, isMounted]);

  // 🛡️ Guard against hydration mismatch: Don't render interactive parts before mount
  // (optional, but helps keep the UI stable)
  // if (!isMounted) return null; // We could return a skeleton or the defaultOpen state

  return (
    <div className="w-full mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-white border-2 border-blue-600 rounded-xl shadow-sm hover:bg-blue-50/30 transition-all duration-200 group"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-600 transition-colors">
            {icon}
          </div>
          <span className="text-gray-800 font-medium text-base">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onMoveUp && (
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMoveUp();
              }}
              className="p-1 text-gray-300 hover:text-blue-600 transition-colors cursor-pointer"
              title="Monter"
            >
              <ArrowUp className="w-4 h-4" />
            </div>
          )}
          {onMoveDown && (
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMoveDown();
              }}
              className="p-1 text-gray-300 hover:text-blue-600 transition-colors cursor-pointer"
              title="Descendre"
            >
              <ArrowDown className="w-4 h-4" />
            </div>
          )}
          <ChevronDown 
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`} 
          />
        </div>
      </button>

      {/* 
        On certain browsers, if we don't wait for mount, 
        the server-rendered HTML might differ from the client-rendered HTML 
        if localStorage has a value.
      */}
      {isOpen && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
}
