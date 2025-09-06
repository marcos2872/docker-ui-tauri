import { useCallback, useEffect, useState } from "react";
import LineChartComponent from "../../components/LineChart";
import MultiLineChartComponent from "../../components/MultiLineChart";
import {
  useMonitoring,
  useMonitoringStats,
} from "../../contexts/MonitoringContext";
import { useDockerApi } from "../../hooks/useDockerApi";
import { useDockerConnection } from "../../contexts/DockerConnectionContext";

interface DockerInfo {
  version: string;
  server_version: string;
  containers_total: number;
  containers_running: number;
  containers_paused: number;
  containers_stopped: number;
  images: number;
  architecture: string;
  os: string;
  kernel_version: string;
}

export function Dashboard() {
  const { getDockerInfo } = useDockerApi();
  const { currentSshConnection, connectionType } = useDockerConnection();
  const [dockerInfo, setDockerInfo] = useState<DockerInfo>({
    version: "",
    server_version: "",
    containers_total: 0,
    containers_running: 0,
    containers_paused: 0,
    containers_stopped: 0,
    images: 0,
    architecture: "",
    os: "",
    kernel_version: "",
  });

  const {
    isMonitoring,
    dataPointsCount,
    startMonitoring,
    clearHistory,
    resumeMonitoring,
  } = useMonitoring();

  const {
    cpuHistory,
    memoryHistory,
    cpuMaxValue,
    memoryMaxValue,
    networkConfig,
    blockConfig,
    cpuTitle,
    memoryTitle,
    networkTitle,
    blockTitle,
  } = useMonitoringStats();

  const getDockerStats = useCallback(async () => {
    try {
      const status = await getDockerInfo();
      setDockerInfo(status);
    } catch (error) {
      console.error("Error fetching docker stats:", error);
    }
  }, [getDockerInfo]);

  // Start monitoring when component mounts and resume when entering dashboard
  useEffect(() => {
    getDockerStats();
    startMonitoring();
    resumeMonitoring(); // Resume monitoring when entering dashboard

    // Set up interval for docker stats (less frequent than system usage)
    const statsInterval = setInterval(getDockerStats, 5000);

    return () => {
      clearInterval(statsInterval);
      // Note: Don't stop monitoring when component unmounts - keep it running
    };
  }, [getDockerStats, startMonitoring, resumeMonitoring]);

  const Card = ({ title, value }: { title: string; value: string }) => (
    <div className="min-w-40 flex flex-col justify-center items-center bg-gray-700 p-2 rounded-lg text-white">
      <h2 className="text-sm font-bold">{title}</h2>
      <p className=" font-bold">{value}</p>
    </div>
  );

  const getMemoryUnit = () => {
    const maxMemory = memoryMaxValue;
    return maxMemory > 1024 ? "GB" : "MB";
  };

  return (
    <div className="grid grid-rows-[auto_auto_1fr] w-full p-4 pb-10 gap-6 h-screen overflow-hidden">
      {/* Header with Monitoring Controls */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${currentSshConnection ? "bg-green-400" : "bg-red-400"}`}
              ></div>
              <span>
                {currentSshConnection
                  ? `SSH: ${currentSshConnection.name || currentSshConnection.host}`
                  : "No SSH Connection"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${isMonitoring ? "bg-green-400 animate-pulse" : "bg-red-400"}`}
              ></div>
              <span>Monitoramento {isMonitoring ? "Ativo" : "Inativo"}</span>
            </div>
            {dataPointsCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-blue-400">{dataPointsCount} pontos</span>
                <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                  {Math.floor(dataPointsCount / 60)}min de histórico
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearHistory}
              disabled={dataPointsCount === 0}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Limpar Histórico
            </button>
          </div>
        </div>
      </div>

      <section className="w-full grid grid-cols-3 gap-2 lg:grid-cols-5">
        <Card title="Version" value={dockerInfo.version} />
        <Card title="Architecture" value={dockerInfo.architecture} />
        <Card
          title="Containers"
          value={dockerInfo.containers_total.toString()}
        />
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

      <section className="w-full flex flex-col gap-4 overflow-y-auto min-h-0">
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

        <MultiLineChartComponent
          data={blockConfig.data}
          dataKeys={["read", "write"]}
          title={blockTitle}
          colors={["#8b5cf6", "#ef4444"]}
          height={300}
          unit={blockConfig.unit}
          showGrid={true}
          showTooltip={true}
          showLegend={true}
          maxDataPoints={120}
          minValue={0}
          maxValue={blockConfig.maxValue}
        />
      </section>
    </div>
  );
}
