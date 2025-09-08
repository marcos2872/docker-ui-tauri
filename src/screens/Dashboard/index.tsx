import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import LineChartComponent from "../../components/LineChart";
import MultiLineChartComponent from "../../components/MultiLineChart";
import {
  useMonitoring,
  useMonitoringStats,
} from "../../contexts/MonitoringContext";

interface DockerInfo {
  version: string;
  containers: number;
  containers_paused: number;
  containers_running: number;
  containers_stopped: number;
  images: number;
  architecture: string;
}

export function Dashboard() {
  const [dockerInfo, setDockerInfo] = useState<DockerInfo>({
    version: "",
    containers: 0,
    containers_paused: 0,
    containers_running: 0,
    containers_stopped: 0,
    images: 0,
    architecture: "",
  });

  const { currentSystemUsage, dataPointsCount, startMonitoring } =
    useMonitoring();

  const {
    cpuHistory,
    memoryHistory,
    cpuMaxValue,
    memoryMaxValue,
    networkConfig,
    cpuTitle,
    memoryTitle,
    networkTitle,
  } = useMonitoringStats();

  const getDockerStats = useCallback(async () => {
    try {
      const status = (await invoke("docker_infos")) as DockerInfo;
      setDockerInfo(status);
    } catch (error) {
      console.error("Error fetching docker stats:", error);
    }
  }, []);

  // Start monitoring when component mounts
  useEffect(() => {
    getDockerStats();
    startMonitoring();

    // Set up interval for docker stats (less frequent than system usage)
    const statsInterval = setInterval(getDockerStats, 5000);

    return () => {
      clearInterval(statsInterval);
      // Don't stop monitoring when component unmounts - keep it running
    };
  }, [getDockerStats, startMonitoring]);

  const Card = ({ title, value }: { title: string; value: string }) => (
    <div className="min-w-40 flex flex-col justify-center items-center bg-gray-700 p-2 rounded-lg text-white">
      <h2 className="text-sm font-bold">{title}</h2>
      <p className=" font-bold">{value}</p>
    </div>
  );

  const getMemoryUnit = () => {
    const memoryLimitMB = currentSystemUsage.memory_usage / 1024 / 1024;
    return memoryLimitMB > 1024 ? "GB" : "MB";
  };

  return (
    <div className="flex flex-col w-full p-4 justify-center gap-6">
      {/* Header with Monitoring Controls */}
      <div className="flex items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-4 text-sm text-gray-300">
            {dataPointsCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-blue-400">{dataPointsCount} pontos</span>
                <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                  {Math.floor(dataPointsCount / 60)}min de histórico
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2"></div>
        </div>
      </div>

      <section className="w-full grid grid-cols-3 gap-2 lg:grid-cols-5">
        <Card title="Version" value={dockerInfo.version} />
        <Card title="Architecture" value={dockerInfo.architecture} />
        <Card title="Containers" value={dockerInfo.containers.toString()} />
        <Card title="Images" value={dockerInfo.images.toString()} />
        <Card
          title="Containers Paused"
          value={dockerInfo.containers_paused.toString()}
        />
        <Card
          title="Containers Running"
          value={dockerInfo.containers_running.toString()}
        />
        <Card
          title="Containers Stopped"
          value={dockerInfo.containers_stopped.toString()}
        />
      </section>

      <section className="w-full h-full flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-282px)] mb-10">
        <LineChartComponent
          data={cpuHistory}
          dataKey="value"
          title={cpuTitle}
          color="#3b82f6"
          height={300}
          unit="%"
          showGrid={true}
          showTooltip={true}
          showLegend={false}
          maxDataPoints={120}
          minValue={0}
          maxValue={cpuMaxValue}
        />

        <LineChartComponent
          data={memoryHistory}
          dataKey="value"
          title={memoryTitle}
          color="#10b981"
          height={300}
          unit={getMemoryUnit()}
          showGrid={true}
          showTooltip={true}
          showLegend={false}
          maxDataPoints={120}
          minValue={0}
          maxValue={memoryMaxValue}
        />

        <MultiLineChartComponent
          data={networkConfig.data}
          dataKeys={["rx", "tx"]}
          title={networkTitle}
          colors={["#10b981", "#f59e0b"]}
          height={300}
          unit={networkConfig.unit}
          showGrid={true}
          showTooltip={true}
          showLegend={true}
          maxDataPoints={120}
          minValue={0}
          maxValue={networkConfig.maxValue}
        />
      </section>
    </div>
  );
}
