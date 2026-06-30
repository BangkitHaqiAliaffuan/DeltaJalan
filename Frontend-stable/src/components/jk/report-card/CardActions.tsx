import { Link } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import type { ActionButton } from "./types";

interface CardActionsProps {
  actions: ActionButton[];
}

const VARIANT_STYLES: Record<string, string> = {
  primary: "bg-[#1e40af] text-white hover:bg-[#173bab] disabled:opacity-40",
  secondary:
    "border border-[#1e40af] text-[#1e40af] bg-white hover:bg-[#EEF2FF] disabled:opacity-40",
  destructive:
    "border border-red-200 text-[#E11D48] bg-red-50 hover:bg-red-100 disabled:opacity-40",
};

const BASE = "flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all";

function ActionButtonItem({ action }: { action: ActionButton }) {
  const className = `${BASE} ${VARIANT_STYLES[action.variant]}`;

  if (action.to) {
    return (
      <Link to={action.to} search={action.search} className={className} title={action.label}>
        {action.icon && <Icon name={action.icon} className="!text-[13px]" />}
        {action.label}
      </Link>
    );
  }

  return (
    <button onClick={action.onClick} disabled={action.disabled} className={className}>
      {action.icon && <Icon name={action.icon} className="!text-[13px]" />}
      {action.label}
    </button>
  );
}

export function CardActions({ actions }: CardActionsProps) {
  if (actions.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {actions.map((a, i) => (
        <ActionButtonItem key={i} action={a} />
      ))}
    </div>
  );
}
