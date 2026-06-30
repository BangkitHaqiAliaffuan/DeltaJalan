import type { GpsStatus } from "@/hooks/useLocationFromPhoto";
import { Icon } from "@/components/jk/Icon";

const variants: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  detecting: {
    bg: "bg-[#EFF6FF]",
    border: "border-[#93C5FD]",
    text: "text-[#1E40AF]",
    icon: "gps_fixed",
  },
  geocoding: {
    bg: "bg-[#EFF6FF]",
    border: "border-[#93C5FD]",
    text: "text-[#1E40AF]",
    icon: "travel_explore",
  },
  success: {
    bg: "bg-[#D1FAE5]",
    border: "border-[#6EE7B7]",
    text: "text-[#065F46]",
    icon: "check_circle",
  },
  auto_geolocating: {
    bg: "bg-[#EFF6FF]",
    border: "border-[#93C5FD]",
    text: "text-[#1E40AF]",
    icon: "my_location",
  },
  exif_no_gps: {
    bg: "bg-[#FEF3C7]",
    border: "border-[#FCD34D]",
    text: "text-[#92400E]",
    icon: "info",
  },
  permission_denied: {
    bg: "bg-[#FEE2E2]",
    border: "border-[#FCA5A5]",
    text: "text-[#991B1B]",
    icon: "location_off",
  },
  timeout: {
    bg: "bg-[#FEF3C7]",
    border: "border-[#FCD34D]",
    text: "text-[#92400E]",
    icon: "timer_off",
  },
  error: {
    bg: "bg-[#FEE2E2]",
    border: "border-[#FCA5A5]",
    text: "text-[#991B1B]",
    icon: "error",
  },
};

export function GpsBanner({
  status,
  message,
  lat,
  lng,
}: {
  status: GpsStatus;
  message: string;
  lat: number | null;
  lng: number | null;
}) {
  if (status === "idle") return null;

  const v = variants[status] ?? variants.error;
  const isSpinning =
    status === "detecting" || status === "geocoding" || status === "auto_geolocating";

  return (
    <div className={`flex items-start gap-2.5 ${v.bg} border ${v.border} rounded-lg px-4 py-3`}>
      {isSpinning ? (
        <span
          className={`w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin shrink-0 mt-0.5 ${v.text}`}
        />
      ) : (
        <Icon
          name={v.icon}
          className={`${v.text} !text-[20px] shrink-0 mt-0.5`}
          filled={status === "success"}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className={`font-label-md text-[12px] leading-relaxed ${v.text}`}>{message}</p>
        {status === "success" && lat !== null && lng !== null && (
          <p className={`font-id-code text-[10px] mt-0.5 ${v.text} opacity-70`}>
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}
