import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import LineChartComponent from "../LineChart";
import MultiLineChartComponent from "../MultiLineChart";

interface DockerInfo {
  version: string;
  containers: number;
  containers_paused: number;
  containers_running: number;
  containers_stopped: number;
  images: number;
  architecture: string;
}

interface DockerSystemUsage {
  cpu_online: number;
  cpu_usage: number;
  memory_usage: number;
  memory_limit: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  block_read_bytes: number;
  block_write_bytes: number;
}

interface CpuDataPoint {
  time: string;
  value: number;
}

interface MemoryDataPoint {
  time: string;
  value: number;
}

interface NetworkDataPoint {
  time: string;
  rx: number;
  tx: number;
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

  const [dockerSistemUsage, setDockerSistemUsage] = useState<DockerSystemUsage>(
    {
      cpu_online: 0,
      cpu_usage: 0,
      memory_usage: 0,
      memory_limit: 0,
      network_rx_bytes: 0,
      network_tx_bytes: 0,
      block_read_bytes: 0,
      block_write_bytes: 0,
    },
  );

  const [cpuHistory, setCpuHistory] = useState<CpuDataPoint[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<MemoryDataPoint[]>([]);
  const [networkHistory, setNetworkHistory] = useState<NetworkDataPoint[]>([]);
  const intervalRef = useRef<number | null>(null);

  const getDockerSistemUsage = useCallback(async () => {
    try {
      const sistemUsage = (await invoke(
        "docker_system_usage",
      )) as DockerSystemUsage;
      setDockerSistemUsage(sistemUsage);

      // Add CPU data to history
      const now = new Date();
      const timeStr = now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setCpuHistory((prev) => {
        const cpuPercentage = sistemUsage.cpu_usage;
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            value: cpuPercentage,
          },
        ];

        return newHistory.slice(-60);
      });

      // Add Memory data to history (in MB)
      setMemoryHistory((prev) => {
        const memoryUsageMB = sistemUsage.memory_usage / 1024 / 1024;
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            value: memoryUsageMB,
          },
        ];

        return newHistory.slice(-60);
      });

      // Add Network data to history (RX and TX separate in bytes)
      setNetworkHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            rx: sistemUsage.network_rx_bytes,
            tx: sistemUsage.network_tx_bytes,
          },
        ];

        return newHistory.slice(-60);
      });
    } catch (error) {
      console.error("Error fetching system usage:", error);
    }
  }, []);

  const getDockerStats = useCallback(async () => {
    const status = (await invoke("docker_infos")) as DockerInfo;
    setDockerInfo(status);
  }, []);

  useEffect(() => {
    getDockerStats();
    getDockerSistemUsage();

    // Set up interval for real-time updates every 1 second
    intervalRef.current = setInterval(() => {
      getDockerSistemUsage();
      getDockerStats();
    }, 1000);

    // Cleanup interval on component unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [getDockerSistemUsage, getDockerStats]);

  const Card = ({ title, value }: { title: string; value: string }) => (
    <div className="min-w-40 flex flex-col justify-center items-center bg-gray-700 p-2 rounded-lg text-white">
      <h2 className="text-sm font-bold">{title}</h2>
      <p className=" font-bold">{value}</p>
    </div>
  );

  const cpuMaxValue = useMemo(() => {
    const cpuOnlineMax = dockerSistemUsage.cpu_online * 100;

    if (cpuHistory.length === 0) {
      return Math.min(100, cpuOnlineMax);
    }

    const historyMax = Math.max(...cpuHistory.map((point) => point.value));
    const maxValueWith10Percent = historyMax * 0.1;
    const maxValue = Math.min(maxValueWith10Percent, cpuOnlineMax);

    // Garantir um valor mínimo para visualização
    return Math.max(maxValue, 0.1);
  }, [cpuHistory, dockerSistemUsage.cpu_online]);

  const memoryMaxValue = useMemo(() => {
    const memoryLimitMB = dockerSistemUsage.memory_limit / 1024 / 1024;

    if (memoryHistory.length === 0) {
      return memoryLimitMB > 0 ? memoryLimitMB : 1024;
    }

    const historyMax = Math.max(...memoryHistory.map((point) => point.value));
    const maxValueWith10Percent = historyMax + historyMax * 0.1;
    const maxValue = Math.min(maxValueWith10Percent, memoryLimitMB);

    // Garantir um valor mínimo para visualização
    return Math.max(maxValue, 100);
  }, [memoryHistory, dockerSistemUsage.memory_limit]);

  const formatMemoryValue = (bytes: number, unit: "MB" | "GB" = "MB") => {
    if (unit === "GB") {
      return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  };

  const getMemoryTitle = () => {
    const usageInMB = dockerSistemUsage.memory_usage / 1024 / 1024;

    const usageDisplay =
      usageInMB > 1024
        ? formatMemoryValue(dockerSistemUsage.memory_usage, "GB")
        : formatMemoryValue(dockerSistemUsage.memory_usage, "MB");

    const limitDisplay = formatMemoryValue(
      dockerSistemUsage.memory_limit,
      "GB",
    );

    return `Memória RAM: ${usageDisplay} / ${limitDisplay}`;
  };

  const getMemoryUnit = () => {
    const memoryLimitMB = dockerSistemUsage.memory_usage / 1024 / 1024;
    return memoryLimitMB > 1024 ? "GB" : "MB";
  };

  const getNetworkUnit = () => {
    if (networkHistory.length === 0) {
      return { unit: "KB", divisor: 1024 };
    }

    const allValues = networkHistory.flatMap((point) => [point.rx, point.tx]);
    const maxBytes = Math.max(...allValues);

    if (maxBytes >= 1024 * 1024 * 1024) {
      return { unit: "GB", divisor: 1024 * 1024 * 1024 };
    } else if (maxBytes >= 1024 * 1024) {
      return { unit: "MB", divisor: 1024 * 1024 };
    } else {
      return { unit: "KB", divisor: 1024 };
    }
  };

  const networkConfig = useMemo(() => {
    const { unit, divisor } = getNetworkUnit();

    if (networkHistory.length === 0) {
      return { unit, maxValue: 10, data: [] };
    }

    const convertedData = networkHistory.map((point) => ({
      time: point.time,
      rx: point.rx / divisor,
      tx: point.tx / divisor,
    }));

    const allValues = convertedData.flatMap((point) => [point.rx, point.tx]);
    const historyMax = Math.max(...allValues);
    const maxValueWith10Percent = historyMax + historyMax * 0.1;
    const maxValue = Math.max(
      maxValueWith10Percent,
      unit === "GB" ? 0.1 : unit === "MB" ? 1 : 10,
    );

    return { unit, maxValue, data: convertedData };
  }, [networkHistory]);

  const formatNetworkValue = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
  };

  const getNetworkTitle = () => {
    const rx = formatNetworkValue(dockerSistemUsage.network_rx_bytes);
    const tx = formatNetworkValue(dockerSistemUsage.network_tx_bytes);

    return `Rede RX: ${rx} | TX: ${tx}`;
  };

  return (
    <div className="flex flex-col w-full p-4 justify-center gap-6">
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
          title={`CPU Total: ${dockerSistemUsage.cpu_usage.toFixed(2)}% | ${dockerSistemUsage.cpu_online} cores`}
          color="#3b82f6"
          height={300}
          unit="%"
          showGrid={true}
          showTooltip={true}
          showLegend={false}
          maxDataPoints={60}
          minValue={0}
          maxValue={cpuMaxValue}
        />

        <LineChartComponent
          data={memoryHistory}
          dataKey="value"
          title={getMemoryTitle()}
          color="#10b981"
          height={300}
          unit={getMemoryUnit()}
          showGrid={true}
          showTooltip={true}
          showLegend={false}
          maxDataPoints={60}
          minValue={0}
          maxValue={memoryMaxValue}
        />

        <MultiLineChartComponent
          data={networkConfig.data}
          dataKeys={["rx", "tx"]}
          title={getNetworkTitle()}
          colors={["#10b981", "#f59e0b"]}
          height={300}
          unit={networkConfig.unit}
          showGrid={true}
          showTooltip={true}
          showLegend={true}
          maxDataPoints={60}
          minValue={0}
          maxValue={networkConfig.maxValue}
        />
      </section>
    </div>
  );
}
