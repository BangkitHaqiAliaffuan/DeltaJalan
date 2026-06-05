import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import type { MonthlyTrend } from "@/lib/mockData";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-[#0F172A] mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-[#475569]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold text-[#0F172A]">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

interface MonthlyTrendChartProps {
  data: MonthlyTrend[];
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} barGap={4} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#475569" }}
            tickLine={false}
            axisLine={{ stroke: "#E2E8F0" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#475569" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F1F5F9" }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#475569", paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar
            name="Total Laporan"
            dataKey="total"
            fill="#1e40af"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
          <Bar
            name="Rusak Berat"
            dataKey="rusak_berat"
            fill="#E11D48"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
          <Bar
            name="Selesai"
            dataKey="selesai"
            fill="#10B981"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
