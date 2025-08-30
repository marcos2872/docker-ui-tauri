import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState, useRef } from "react";
import LineChartComponent from "../LineChart";

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
  value: number;
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

      // Add Memory data to history
      setMemoryHistory((prev) => {
        const memoryUsagePercent =
          sistemUsage.memory_limit > 0
            ? (sistemUsage.memory_usage / sistemUsage.memory_limit) * 100
            : 0;
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            value: memoryUsagePercent,
          },
        ];

        return newHistory.slice(-60);
      });

      // Add Network data to history (total TX + RX in MB)
      setNetworkHistory((prev) => {
        const networkTotal =
          (sistemUsage.network_rx_bytes + sistemUsage.network_tx_bytes) /
          (1024 * 1024);
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            value: networkTotal,
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
    <div className="min-w-40 flex flex-col justify-center items-center bg-gray-700 p-2 rounded-lg shadow-md">
      <h2 className="text-sm font-bold">{title}</h2>
      <p className=" font-bold">{value}</p>
    </div>
  );

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

      {/*<section className="w-full grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card
          title="Memória Total"
          value={`${(dockerSistemUsage.memory_usage / 1024 / 1024).toFixed(0)} MB / ${(dockerSistemUsage.memory_limit / 1024 / 1024 / 1024).toFixed(1)} GB`}
        />
        <Card
          title="Rede RX Total"
          value={dockerSistemUsage.network_rx_bytes < 1024 * 1024
            ? `${(dockerSistemUsage.network_rx_bytes / 1024).toFixed(1)} KB`
            : `${(dockerSistemUsage.network_rx_bytes / 1024 / 1024).toFixed(1)} MB`}
        />
        <Card
          title="Rede TX Total"
          value={dockerSistemUsage.network_tx_bytes < 1024 * 1024
            ? `${(dockerSistemUsage.network_tx_bytes / 1024).toFixed(1)} KB`
            : `${(dockerSistemUsage.network_tx_bytes / 1024 / 1024).toFixed(1)} MB`}
        />
        <Card
          title="Disco I/O Total"
          value={`R: ${(dockerSistemUsage.block_read_bytes / 1024 / 1024).toFixed(0)} MB | W: ${(dockerSistemUsage.block_write_bytes / 1024 / 1024).toFixed(0)} MB`}
        />
      </section>*/}

      <section className="w-full h-full flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-250px)] mb-10">
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
        />

        <LineChartComponent
          data={memoryHistory}
          dataKey="value"
          title={`Memória RAM: ${dockerSistemUsage.memory_limit > 0 ? ((dockerSistemUsage.memory_usage / dockerSistemUsage.memory_limit) * 100).toFixed(2) : "0.00"}% | ${(dockerSistemUsage.memory_usage / 1024 / 1024).toFixed(0)} MB / ${(dockerSistemUsage.memory_limit / 1024 / 1024 / 1024).toFixed(1)} GB`}
          color="#10b981"
          height={300}
          unit="%"
          showGrid={true}
          showTooltip={true}
          showLegend={false}
          maxDataPoints={60}
        />

        <LineChartComponent
          data={networkHistory}
          dataKey="value"
          title={`Rede Total: ${((dockerSistemUsage.network_rx_bytes + dockerSistemUsage.network_tx_bytes) / 1024 / 1024).toFixed(2)} MB | RX: ${(dockerSistemUsage.network_rx_bytes / 1024 / 1024).toFixed(1)} MB | TX: ${(dockerSistemUsage.network_tx_bytes / 1024 / 1024).toFixed(1)} MB`}
          color="#f59e0b"
          height={300}
          unit="MB"
          showGrid={true}
          showTooltip={true}
          showLegend={false}
          maxDataPoints={60}
        />
      </section>
    </div>
  );
}
