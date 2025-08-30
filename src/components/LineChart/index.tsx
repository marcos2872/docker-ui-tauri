import React from "react";
import { Chart } from "react-google-charts";

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

const LineChartComponent: React.FC<LineChartComponentProps> = React.memo(
  ({
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
    const chartData = React.useMemo(() => {
      const limitedData = data.slice(-maxDataPoints);

      const headers = ["Time", dataKey];
      const rows = limitedData.map((item) => [item.time, item.value]);

      return [headers, ...rows];
    }, [data, maxDataPoints, dataKey]);

    const options = React.useMemo(
      () => ({
        title: title || undefined,
        titleTextStyle: {
          color: "#ffffff",
          fontSize: 16,
          bold: true,
        },
        backgroundColor: "transparent",
        chartArea: {
          backgroundColor: "transparent",
          width: "90%",
          height: "70%",
        },
        hAxis: {
          textStyle: { color: "#ffffff", fontSize: 11 },
          titleTextStyle: { color: "#ffffff" },
          gridlines: { color: showGrid ? "#555555" : "transparent" },
          minorGridlines: { color: "transparent" },
        },
        vAxis: {
          textStyle: { color: "#ffffff", fontSize: 11 },
          titleTextStyle: { color: "#ffffff" },
          format: unit ? `#${unit}` : undefined,
          gridlines: { color: showGrid ? "#555555" : "transparent" },
          minorGridlines: { color: "transparent" },
        },
        legend: {
          position: showLegend ? "bottom" : "none",
          textStyle: { color: "#ffffff" },
        },
        colors: [color],
        lineWidth: 2,
        pointSize: 0,
        tooltip: {
          isHtml: showTooltip,
          textStyle: { color: "#333333" },
        },
        animation: {
          duration: 0,
          startup: false,
        },
      }),
      [title, showGrid, showLegend, showTooltip, color, unit],
    );

    return (
      <div className="w-full flex flex-col bg-gray-700 rounded-md p-4">
        <Chart
          chartType="LineChart"
          width="100%"
          height={`${height}px`}
          data={chartData}
          options={options}
        />
      </div>
    );
  },
);

LineChartComponent.displayName = "LineChartComponent";

export default LineChartComponent;
