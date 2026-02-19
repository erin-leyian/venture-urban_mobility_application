import React from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

const KPICard = ({ title, value, change, trend, data }) => {
  const safeData = Array.isArray(data) && data.length > 0 ? data : [0];

  const trendIcon =
    trend === "up" ? (
      <ArrowUp size={14} className="text-green-400" />
    ) : trend === "down" ? (
      <ArrowDown size={14} className="text-red-400" />
    ) : (
      <Minus size={14} className="text-gray-400" />
    );

  const trendColor =
    trend === "up"
      ? "text-green-400"
      : trend === "down"
        ? "text-red-400"
        : "text-gray-400";

  return (
    <div className="bg-card-bg rounded-2xl p-5 flex flex-col justify-between shadow-lg border border-[#333] hover:border-[#444] transition-colors">
      <div className="mb-3">
        <h3 className="text-gray-400 text-xs font-medium uppercase tracking-widest">
          {title}
        </h3>
        <div className="text-3xl font-bold mt-1.5 text-white leading-tight">
          {value}
        </div>
        {change && (
          <div
            className={`flex items-center gap-1 text-xs mt-1.5 ${trendColor}`}
          >
            {trendIcon}
            <span>{change} vs last month</span>
          </div>
        )}
      </div>
      <div className="h-14 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={safeData.map((d, i) => ({ value: d, name: i }))}
            margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`grad-${title.replace(/\s/g, "")}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#FFD700" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="#FFD700"
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#grad-${title.replace(/\s/g, "")})`}
              dot={false}
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default KPICard;
