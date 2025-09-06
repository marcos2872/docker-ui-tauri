import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useDockerApi } from "../hooks/useDockerApi";

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

interface BlockDataPoint {
  time: string;
  read: number;
  write: number;
}

interface MonitoringContextType {
  cpuHistory: CpuDataPoint[];
  memoryHistory: MemoryDataPoint[];
  networkHistory: NetworkDataPoint[];
  blockHistory: BlockDataPoint[];
  currentSystemUsage: DockerSystemUsage;
  isMonitoring: boolean;
  dataPointsCount: number;
  lastUpdate: Date | null;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  clearHistory: () => void;
  pauseMonitoring: () => void;
  resumeMonitoring: () => void;
}

const MonitoringContext = createContext<MonitoringContextType | undefined>(
  undefined,
);

interface MonitoringProviderProps {
  children: React.ReactNode;
}

const loadFromStorage = () => {
  try {
    const savedData = localStorage.getItem("docker-monitoring-data");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      return {
        cpuHistory: parsed.cpuHistory || [],
        memoryHistory: parsed.memoryHistory || [],
        networkHistory: parsed.networkHistory || [],
        blockHistory: parsed.blockHistory || [],
        lastUpdate: parsed.lastUpdate ? new Date(parsed.lastUpdate) : null,
      };
    }
  } catch (error) {
    console.error("Error loading monitoring data from storage:", error);
  }
  return {
    cpuHistory: [],
    memoryHistory: [],
    networkHistory: [],
    blockHistory: [],
    lastUpdate: null,
  };
};

export function MonitoringProvider({ children }: MonitoringProviderProps) {
  const { getDockerSystemUsage } = useDockerApi();
  const savedData = loadFromStorage();

  const [cpuHistory, setCpuHistory] = useState<CpuDataPoint[]>(
    savedData.cpuHistory,
  );
  const [memoryHistory, setMemoryHistory] = useState<MemoryDataPoint[]>(
    savedData.memoryHistory,
  );
  const [networkHistory, setNetworkHistory] = useState<NetworkDataPoint[]>(
    savedData.networkHistory,
  );
  const [blockHistory, setBlockHistory] = useState<BlockDataPoint[]>(
    savedData.blockHistory,
  );
  const [currentSystemUsage, setCurrentSystemUsage] =
    useState<DockerSystemUsage>({
      cpu_online: 0,
      cpu_usage: 0,
      memory_usage: 0,
      memory_limit: 0,
      network_rx_bytes: 0,
      network_tx_bytes: 0,
      block_read_bytes: 0,
      block_write_bytes: 0,
    });

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(
    savedData.lastUpdate,
  );
  const intervalRef = useRef<number | null>(null);

  const saveToStorage = useCallback(
    (data: {
      cpuHistory: CpuDataPoint[];
      memoryHistory: MemoryDataPoint[];
      networkHistory: NetworkDataPoint[];
      blockHistory: BlockDataPoint[];
      lastUpdate: Date;
    }) => {
      try {
        localStorage.setItem(
          "docker-monitoring-data",
          JSON.stringify({
            cpuHistory: data.cpuHistory,
            memoryHistory: data.memoryHistory,
            networkHistory: data.networkHistory,
            blockHistory: data.blockHistory,
            lastUpdate: data.lastUpdate.toISOString(),
          }),
        );
      } catch (error) {
        console.error("Error saving monitoring data to storage:", error);
      }
    },
    [],
  );

  const collectData = useCallback(async () => {
    // Skip data collection if monitoring is paused
    if (isPaused) return;

    try {
      const systemUsage = await getDockerSystemUsage();
      setCurrentSystemUsage(systemUsage);
      setLastUpdate(new Date());

      // Add data to history
      const now = new Date();
      const timeStr = now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      // Add CPU data to history (from actual system usage)
      setCpuHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            value: systemUsage.cpu_usage,
          },
        ];

        return newHistory.slice(-120); // Keep last 120 points (2 minutes at 1-second intervals)
      });

      // Add Memory data to history (convert bytes to MB)
      setMemoryHistory((prev) => {
        const memoryUsageMB = systemUsage.memory_usage / (1024 * 1024);
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            value: memoryUsageMB,
          },
        ];

        return newHistory.slice(-120);
      });

      // Add Network data to history (actual bytes)
      setNetworkHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            rx: systemUsage.network_rx_bytes,
            tx: systemUsage.network_tx_bytes,
          },
        ];

        return newHistory.slice(-120);
      });

      // Add Block I/O data to history (actual bytes)
      setBlockHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            read: systemUsage.block_read_bytes,
            write: systemUsage.block_write_bytes,
          },
        ];

        return newHistory.slice(-120);
      });
    } catch (error) {
      console.error("Error collecting monitoring data:", error);
    }
  }, [getDockerSystemUsage, isPaused]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (
      cpuHistory.length > 0 ||
      memoryHistory.length > 0 ||
      networkHistory.length > 0 ||
      blockHistory.length > 0
    ) {
      saveToStorage({
        cpuHistory,
        memoryHistory,
        networkHistory,
        blockHistory,
        lastUpdate: lastUpdate || new Date(),
      });
    }
  }, [
    cpuHistory,
    memoryHistory,
    networkHistory,
    blockHistory,
    lastUpdate,
    saveToStorage,
  ]);

  const startMonitoring = useCallback(() => {
    // Always stop existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsMonitoring(true);

    // Collect initial data
    collectData();

    // Set up interval (every 5 seconds to reduce SSH load)
    intervalRef.current = setInterval(collectData, 5000);
  }, [collectData]);

  const stopMonitoring = useCallback(() => {
    if (isMonitoring) {
      setIsMonitoring(false);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isMonitoring]);

  const clearHistory = useCallback(() => {
    setCpuHistory([]);
    setMemoryHistory([]);
    setNetworkHistory([]);
    setBlockHistory([]);
    setLastUpdate(null);

    // Clear from localStorage
    try {
      localStorage.removeItem("docker-monitoring-data");
    } catch (error) {
      console.error("Error clearing monitoring data from storage:", error);
    }
  }, []);

  const pauseMonitoring = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resumeMonitoring = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Cleanup on unmount and ensure monitoring state consistency
  useEffect(() => {
    // If we have saved data but no active interval, reset monitoring state
    if (isMonitoring && !intervalRef.current) {
      setIsMonitoring(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isMonitoring]);

  const value: MonitoringContextType = {
    cpuHistory,
    memoryHistory,
    networkHistory,
    blockHistory,
    currentSystemUsage,
    isMonitoring,
    dataPointsCount: Math.max(
      cpuHistory.length,
      memoryHistory.length,
      networkHistory.length,
      blockHistory.length,
    ),
    lastUpdate,
    startMonitoring,
    stopMonitoring,
    clearHistory,
    pauseMonitoring,
    resumeMonitoring,
  };

  return (
    <MonitoringContext.Provider value={value}>
      {children}
    </MonitoringContext.Provider>
  );
}

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (context === undefined) {
    throw new Error("useMonitoring must be used within a MonitoringProvider");
  }
  return context;
}

// Hook for computed monitoring statistics
export function useMonitoringStats() {
  const {
    cpuHistory,
    memoryHistory,
    networkHistory,
    blockHistory,
    currentSystemUsage,
    dataPointsCount,
  } = useMonitoring();

  const formatBytes = (bytes: number, decimals: number = 1) => {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);

    // Para bytes, não mostramos decimais
    if (i === 0) {
      return `${value} ${sizes[i]}`;
    }

    return `${value.toFixed(decimals)} ${sizes[i]}`;
  };

  const getCpuMaxValue = () => {
    if (cpuHistory.length === 0) {
      return Math.max(100, currentSystemUsage.cpu_online * 100 || 100);
    }

    const historyMax = Math.max(...cpuHistory.map((point) => point.value));
    const maxValueWith10Percent = historyMax + historyMax * 0.1;

    return Math.max(
      Math.min(
        maxValueWith10Percent,
        currentSystemUsage.cpu_online * 100 || 100,
      ),
      50,
    );
  };

  const getMemoryMaxValue = () => {
    if (memoryHistory.length === 0) {
      return currentSystemUsage.memory_limit / (1024 * 1024); // Convert to MB
    }

    const historyMax = Math.max(...memoryHistory.map((point) => point.value));
    const maxValueWith10Percent = historyMax + historyMax * 0.1;
    const memoryLimitMB = currentSystemUsage.memory_limit / (1024 * 1024);

    return Math.max(Math.min(maxValueWith10Percent, memoryLimitMB), 512); // Minimum 512MB
  };

  const getNetworkConfig = () => {
    if (networkHistory.length === 0) {
      return { unit: "KB", maxValue: 10, data: [] };
    }

    const allValues = networkHistory.flatMap((point) => [point.rx, point.tx]);
    const maxBytes = Math.max(...allValues);

    let unit: string, divisor: number;
    if (maxBytes >= 1024 * 1024 * 1024) {
      unit = "GB";
      divisor = 1024 * 1024 * 1024;
    } else if (maxBytes >= 1024 * 1024) {
      unit = "MB";
      divisor = 1024 * 1024;
    } else {
      unit = "KB";
      divisor = 1024;
    }

    const convertedData = networkHistory.map((point) => ({
      time: point.time,
      rx: point.rx / divisor,
      tx: point.tx / divisor,
    }));

    const convertedValues = convertedData.flatMap((point) => [
      point.rx,
      point.tx,
    ]);
    const historyMax = Math.max(...convertedValues);
    const maxValueWith10Percent = historyMax + historyMax * 0.1;
    const maxValue = Math.max(
      maxValueWith10Percent,
      unit === "GB" ? 0.1 : unit === "MB" ? 1 : 10,
    );

    return { unit, maxValue, data: convertedData };
  };

  const getBlockConfig = () => {
    if (blockHistory.length === 0) {
      return { unit: "KB", maxValue: 10, data: [] };
    }

    const allValues = blockHistory.flatMap((point) => [
      point.read,
      point.write,
    ]);
    const maxBytes = Math.max(...allValues);

    let unit: string, divisor: number;
    if (maxBytes >= 1024 * 1024 * 1024) {
      unit = "GB";
      divisor = 1024 * 1024 * 1024;
    } else if (maxBytes >= 1024 * 1024) {
      unit = "MB";
      divisor = 1024 * 1024;
    } else {
      unit = "KB";
      divisor = 1024;
    }

    const convertedData = blockHistory.map((point) => ({
      time: point.time,
      read: point.read / divisor,
      write: point.write / divisor,
    }));

    const convertedValues = convertedData.flatMap((point) => [
      point.read,
      point.write,
    ]);
    const historyMax = Math.max(...convertedValues);
    const maxValueWith10Percent = historyMax + historyMax * 0.1;
    const maxValue = Math.max(
      maxValueWith10Percent,
      unit === "GB" ? 0.1 : unit === "MB" ? 1 : 10,
    );

    return { unit, maxValue, data: convertedData };
  };

  const getHistoryDuration = () => {
    const minutes = Math.floor(dataPointsCount / 60);
    const seconds = dataPointsCount % 60;
    return minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`;
  };

  return {
    // Raw data
    cpuHistory,
    memoryHistory,
    networkHistory,
    blockHistory,
    currentSystemUsage,
    dataPointsCount,

    // Computed values
    cpuMaxValue: getCpuMaxValue(),
    memoryMaxValue: getMemoryMaxValue(),
    networkConfig: getNetworkConfig(),
    blockConfig: getBlockConfig(),
    historyDuration: getHistoryDuration(),

    // Formatters
    formatBytes,

    // Titles
    cpuTitle: `CPU ${currentSystemUsage.cpu_usage.toFixed(2)}% / ${currentSystemUsage.cpu_online} cores`,
    memoryTitle: `Memory ${formatBytes(currentSystemUsage.memory_usage, 2)} - ${formatBytes(currentSystemUsage.memory_limit, 2)} total`,
    networkTitle: `Network I/O - RX/TX`,
    blockTitle: `Block I/O - Read/Write`,
  };
}
