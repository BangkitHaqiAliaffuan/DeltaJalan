import { Portal } from "./Portal";
import { Icon } from "./Icon";

interface ActionSheetOption {
  icon: string;
  label: string;
  onClick: () => void;
}

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  options: ActionSheetOption[];
  title?: string;
}

export function ActionSheet({ isOpen, onClose, options, title }: ActionSheetProps) {
  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999]" onClick={onClose} aria-hidden="true">
        <div className="absolute inset-0 bg-black/50" />
        <div
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl pb-8 pt-2 px-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-10 h-1 bg-[#D0DAE8] rounded-full mx-auto mb-3" />

          {title && (
            <p className="text-sm font-semibold text-[#0F172A] text-center mb-3">{title}</p>
          )}

          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={opt.onClick}
                className="w-full h-12 flex items-center gap-3 px-4 rounded-lg text-sm font-medium text-[#0F172A] hover:bg-[#F1F5F9] active:scale-[0.98] transition-all"
              >
                <Icon name={opt.icon} className="!text-[22px] text-[#476788]" />
                {opt.label}
              </button>
            ))}

            <div className="border-t border-[#E2E8F0] my-1" />

            <button
              type="button"
              onClick={onClose}
              className="w-full h-12 rounded-lg text-sm font-medium text-[#476788] hover:bg-[#F1F5F9] active:scale-[0.98] transition-all"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
