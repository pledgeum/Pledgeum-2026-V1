'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  storageKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  storageKey,
  defaultOpen = true,
  children
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      setIsOpen(stored === 'true');
    }
    setIsInitialized(true);
  }, [storageKey]);

  // Sync state to localStorage
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(storageKey, String(isOpen));
    }
  }, [isOpen, storageKey, isInitialized]);

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
        <ChevronDown 
          className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`} 
        />
      </button>

      {isOpen && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );
}
