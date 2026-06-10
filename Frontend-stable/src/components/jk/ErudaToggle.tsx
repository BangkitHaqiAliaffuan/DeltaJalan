import { useState, useEffect } from "react";

export function ErudaToggle() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function toggle() {
    if (!open) {
      setOpen(true);
      import("eruda").then((m) => m.default.init());
    } else {
      setOpen(false);
      import("eruda").then((m) => m.default.destroy());
    }
  }

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      title="Toggle Eruda Debug"
      className="fixed bottom-20 right-2 z-[9999] flex size-7 items-center justify-center rounded-full bg-black/40 text-[10px] font-bold text-white/70 shadow transition-colors hover:bg-black/60 hover:text-white"
    >
      {open ? "×" : "ε"}
    </button>
  );
}
