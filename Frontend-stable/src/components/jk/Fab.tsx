import { Link } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { getCurrentUser } from "@/lib/auth";
import { useEffect, useState } from "react";

export default function Fab() {
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  if (!user) return null;

  const isWarga = user.role === "warga";
  const isPetugas = user.role === "petugas";

  if (!isPetugas && !isWarga) return null;

  const to = isWarga ? "/warga/lapor" : "/upload";

  return (
    <Link
      to={to}
      className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl shadow-primary/30 transition-all active:scale-90 hover:scale-105 hover:bg-[#173bab] bg-primary"
    >
      <Icon name="add" className="!text-[28px] font-bold text-white" />
    </Link>
  );
}
