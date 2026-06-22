import { Portal } from "./Portal";
import { Icon } from "./Icon";

interface ModalBaseProps {
  onClose: () => void;
  icon: string;
  badge?: string;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function ModalBase({ onClose, icon, badge, title, children, footer }: ModalBaseProps) {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.55)" }}
        onClick={onClose}
        aria-hidden="true"
      >
        <div
          className="w-full max-w-sm bg-white rounded-xl border border-[#E2E8F0] shadow-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Blue gradient header */}
          <div className="bg-gradient-to-r from-[#1e40af] to-[#2e68d8] px-5 py-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Icon name={icon} className="text-white !text-[24px]" />
            </div>
            <div className="flex-1 min-w-0">
              {badge && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-white/15 text-white border border-white/10 mb-1.5"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {badge}
                </span>
              )}
              <h2 className="text-[16px] font-bold text-white leading-tight">{title}</h2>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-3">{children}</div>

          {/* Footer */}
          {footer && <div className="px-5 pb-5 flex flex-col gap-2">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}
