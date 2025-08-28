import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  time: string;
  value: number;
  [key: string]: any;
}

interface LineChartComponentProps {
  data: DataPoint[];
  dataKey: string;
  title?: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  unit?: string;
  maxDataPoints?: number;
}

const LineChartComponent: React.FC<LineChartComponentProps> = React.memo(({
  data,
  dataKey,
  title = "Chart",
  color = "#8884d8",
  height = 250,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  unit = "",
  maxDataPoints = 60,
}) => {
  const formatTooltipValue = (value: any) => {
    if (typeof value === "number") {
      return `${value}${unit}`;
    }
    return value;
  };

  const formatYAxisLabel = (value: any) => {
    if (typeof value === "number") {
      return `${value}${unit}`;
    }
    return value;
  };

  const formatXAxisLabel = (value: string) => {
    const parts = value.split(":");
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:${parts[2]}`;
    }
    return value;
  };

  // Use data directly to avoid unnecessary re-renders and flicker
  const chartData = React.useMemo(() => {
    return data.slice(-maxDataPoints);
  }, [data, maxDataPoints]);

  return (
    <div className="w-full flex flex-col bg-gray-700 rounded-md p-4">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            bottom: 5,
            left: -20,
            right: 5,
          }}
          isAnimationActive={false}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis
            dataKey="time"
            tickFormatter={formatXAxisLabel}
            fontSize={12}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tickFormatter={formatYAxisLabel} fontSize={12} />
          {showTooltip && (
            <Tooltip
              formatter={(value) => [formatTooltipValue(value), dataKey]}
              labelStyle={{ color: "#333" }}
              contentStyle={{
                backgroundColor: "#f8f9fa",
                border: "1px solid #dee2e6",
                borderRadius: "4px",
              }}
            />
          )}
          {showLegend && <Legend />}
          <Line
            type="linear"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

LineChartComponent.displayName = 'LineChartComponent';

export default LineChartComponent;
