import { Icon } from "@/components/jk/Icon";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: ReactNode;
  confirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Ya, Hapus",
  cancelText = "Batal",
  icon,
  confirmLoading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes confirm-in {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .confirm-popup { animation: confirm-in 0.35s ease-out; }
      `}</style>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col items-center gap-4 confirm-popup max-w-sm w-full mx-4">
          {icon ?? (
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <Icon name="delete" className="!text-3xl text-[#E11D48] animate-ping [animation-duration:600ms] [animation-iteration-count:1]" />
            </div>
          )}
          <p className="text-lg font-bold text-[#0F172A] text-center">{title}</p>
          <p className="text-sm text-[#475569] text-center leading-relaxed">{message}</p>
          <div className="flex items-center gap-3 mt-2 w-full">
            <button
              onClick={onCancel}
              disabled={confirmLoading}
              className="flex-1 px-4 py-2.5 text-[13px] font-bold text-[#475569] bg-[#F1F5F9] rounded-xl hover:bg-[#E2E8F0] disabled:opacity-40 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={confirmLoading}
              className="flex-1 px-4 py-2.5 text-[13px] font-bold text-white bg-[#E11D48] rounded-xl hover:bg-[#BE123C] disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
            >
              {confirmLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Icon name="delete" className="!text-[14px]" />
                  {confirmText}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
