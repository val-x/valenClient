import { motion, AnimatePresence } from 'framer-motion';
import { type ReactNode, type MouseEvent } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  cancelLabel?: string;
  children?: ReactNode;
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = 'OK',
  onConfirm,
  cancelLabel,
  children,
}: ModalProps): JSX.Element | null => {
  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-[90vw] max-w-md rounded-2xl bg-gradient-to-br from-black/90 via-black/95 to-black/98 border border-white/10 shadow-2xl"
          >
            {/* Gradient background effects */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-cyan-500/20 blur-3xl animate-pulse" />
              <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-violet-500/20 blur-3xl animate-pulse delay-300" />
            </div>

            <div className="relative">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 backdrop-blur-sm border border-white/5">
                    <div className="i-ph:warning-circle text-2xl text-white" />
                  </div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    {title}
                  </h2>
                </div>
                <button className="p-1 rounded-lg hover:bg-white/5 transition-colors" onClick={onClose}>
                  <div className="i-ph:x text-lg text-white/70 hover:text-white/90" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-sm text-white/70 mb-6 leading-relaxed">{message}</p>
                {children}

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6">
                  {cancelLabel && (
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm text-white/70 hover:text-white/90 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      {cancelLabel}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onConfirm?.();
                      onClose();
                    }}
                    className="px-4 py-2 text-sm text-white font-medium rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 transition-colors"
                  >
                    {confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
