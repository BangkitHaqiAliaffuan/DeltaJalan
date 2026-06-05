import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { DistrictStat } from "@/lib/mockData";

const COLORS = [
  "#1e40af", "#E11D48", "#059669", "#D97706", "#7C3AED",
  "#0891B2", "#DC2626", "#0D9488", "#9333EA", "#EA580C",
  "#2563EB", "#16A34A", "#CA8A04", "#DB2777", "#4F46E5",
  "#65A30D", "#0EA5E9", "#D946EF",
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: DistrictStat }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const total = payload[0].value;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-[#0F172A]">{d.district}</p>
      <p className="text-[#1e40af] font-bold text-lg mt-0.5">{total} laporan</p>
      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#475569]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#E11D48]" />
          B {d.rusak_berat}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#F97316]" />
          S {d.rusak_sedang}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
          R {d.rusak_ringan}
        </span>
      </div>
    </div>
  );
}

interface DistrictPieChartProps {
  data: DistrictStat[];
}

export function DistrictPieChart({ data }: DistrictPieChartProps) {
  const sorted = [...data].sort((a, b) => b.total - a.total);
  const grandTotal = sorted.reduce((s, d) => s + d.total, 0);
  const chartData = sorted;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={480}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="total"
            nameKey="district"
            cx="50%"
            cy="42%"
            innerRadius={80}
            outerRadius={150}
            paddingAngle={2}
            strokeWidth={1.5}
            stroke="#fff"
          >
            {chartData.map((_, i) => (
              <Cell
                key={i}
                fill={COLORS[i % COLORS.length]}
                className="hover:opacity-80 transition-opacity"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value: string) => {
              const item = chartData.find((d) => d.district === value);
              const pct = item ? Math.round((item.total / grandTotal) * 100) : 0;
              return `${value}  (${pct}%)`;
            }}
            wrapperStyle={{ fontSize: 11, color: "#475569", paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
