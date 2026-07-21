'use client';

import { ReactNode, useEffect } from 'react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
};
   
export default function Modal({        
  isOpen,
  onClose,
  title,
  children,    
  footer,
}: ModalProps) {
  // Fermer avec ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {/* Click outside */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-xl overflow-hidden animate-[slideUp_0.3s_ease-out]">

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b shrink-0">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 min-w-0 truncate">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-xl shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-4 sm:px-6 py-4 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-4 border-t bg-gray-50 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
