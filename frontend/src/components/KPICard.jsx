import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowUp, ArrowDown } from "lucide-react";

const KPICard = ({ title, value, change, trend, data }) => {
  return (
    <div className="bg-card-bg rounded-2xl p-6 flex flex-col justify-between shadow-lg">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
          <div className="text-3xl font-bold mt-1 text-white">{value}</div>
          <div
            className={`flex items-center text-sm mt-1 ${trend === "up" ? "text-green-500" : "text-red-500"}`}
          >
            {trend === "up" ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            <span className="ml-1">{change} vs last month</span>
          </div>
        </div>
      </div>
      <div className="h-16 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data.map((d, i) => ({ value: d, name: i }))}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`gradient-${title}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="#FFD700"
              fillOpacity={1}
              fill={`url(#gradient-${title})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default KPICard;
