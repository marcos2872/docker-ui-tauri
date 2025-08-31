import React from "react";
import { Chart } from "react-google-charts";

interface DataPoint {
  time: string;
  [key: string]: any;
}

interface MultiLineChartComponentProps {
  data: DataPoint[];
  dataKeys: string[];
  title?: string;
  colors?: string[];
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  unit?: string;
  maxDataPoints?: number;
  minValue?: number;
  maxValue?: number;
}

const MultiLineChartComponent: React.FC<MultiLineChartComponentProps> =
  React.memo(
    ({
      data,
      dataKeys,
      title = "Chart",
      colors = ["#8884d8", "#82ca9d"],
      height = 250,
      showGrid = true,
      showTooltip = true,
      showLegend = true,
      unit = "",
      maxDataPoints = 60,
      minValue,
      maxValue,
    }) => {
      const chartData = React.useMemo(() => {
        const limitedData = data.slice(-maxDataPoints);

        const headers = ["Time", ...dataKeys];
        const rows = limitedData.map((item) => [
          item.time,
          ...dataKeys.map((key) => item[key] || 0),
        ]);

        return [headers, ...rows];
      }, [data, maxDataPoints, dataKeys]);

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
            width: "88%",
            height: "60%",
            bottom: "20%",
          },
          hAxis: {
            textStyle: { color: "#ffffff", fontSize: 11 },
            titleTextStyle: { color: "#ffffff" },
            gridlines: { color: showGrid ? "#555555" : "transparent" },
            minorGridlines: { color: "transparent" },
            slantedText: true,
            slantedTextAngle: 45,
          },
          vAxis: {
            textStyle: { color: "#ffffff", fontSize: 11 },
            titleTextStyle: { color: "#ffffff" },
            format: unit ? `#${unit}` : undefined,
            gridlines: { color: showGrid ? "#555555" : "transparent" },
            minorGridlines: { color: "transparent" },
            minValue: minValue,
            maxValue: maxValue,
          },
          legend: {
            position: showLegend ? "bottom" : "none",
            textStyle: { color: "#ffffff" },
          },
          colors: colors,
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
        [
          title,
          showGrid,
          showLegend,
          showTooltip,
          colors,
          unit,
          minValue,
          maxValue,
        ],
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

MultiLineChartComponent.displayName = "MultiLineChartComponent";

export default MultiLineChartComponent;
