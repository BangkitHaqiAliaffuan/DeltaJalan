import { Icon } from "@/components/jk/Icon";
import { ModalBase } from "@/components/jk/ModalBase";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: string;
  confirmClassName?: string;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Ya, Hapus",
  cancelText = "Batal",
  confirmLoading,
  onConfirm,
  onCancel,
  icon = "delete",
  confirmClassName = "flex-1 px-4 py-2.5 text-[13px] font-bold text-white bg-[#E11D48] rounded-xl hover:bg-[#BE123C] disabled:opacity-40 transition-all flex items-center justify-center gap-1.5",
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <ModalBase
      onClose={onCancel}
      icon={icon}
      badge="KONFIRMASI"
      title={title}
      footer={
        <div className="flex items-center gap-3 w-full">
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
            className={confirmClassName}
          >
            {confirmLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Icon name={icon} className="!text-[14px]" />
                {confirmText}
              </>
            )}
          </button>
        </div>
      }
    >
      <p className="text-[13px] text-[#475569] text-center leading-relaxed">{message}</p>
    </ModalBase>
  );
}
