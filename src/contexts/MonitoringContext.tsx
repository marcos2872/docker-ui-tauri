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
  containers_running: number;
  containers_total: number;
  images_total: number;
  system_info: string;
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

interface MonitoringContextType {
  cpuHistory: CpuDataPoint[];
  memoryHistory: MemoryDataPoint[];
  networkHistory: NetworkDataPoint[];
  currentSystemUsage: DockerSystemUsage;
  isMonitoring: boolean;
  dataPointsCount: number;
  lastUpdate: Date | null;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  clearHistory: () => void;
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
  const [currentSystemUsage, setCurrentSystemUsage] =
    useState<DockerSystemUsage>({
      containers_running: 0,
      containers_total: 0,
      images_total: 0,
      system_info: "",
    });

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(
    savedData.lastUpdate,
  );
  const intervalRef = useRef<number | null>(null);

  const saveToStorage = useCallback(
    (data: {
      cpuHistory: CpuDataPoint[];
      memoryHistory: MemoryDataPoint[];
      networkHistory: NetworkDataPoint[];
      lastUpdate: Date;
    }) => {
      try {
        localStorage.setItem(
          "docker-monitoring-data",
          JSON.stringify({
            cpuHistory: data.cpuHistory,
            memoryHistory: data.memoryHistory,
            networkHistory: data.networkHistory,
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

      // Add CPU data to history
      setCpuHistory((prev) => {
        const cpuPercentage = systemUsage.containers_running;
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            value: cpuPercentage * 0.01,
          },
        ];

        return newHistory.slice(-120); // Keep last 120 points (2 minutes at 1-second intervals)
      });

      // Add Memory data to history (in MB)
      setMemoryHistory((prev) => {
        const memoryUsageMB = systemUsage.containers_total;
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            value: memoryUsageMB,
          },
        ];

        return newHistory.slice(-120);
      });

      // Add Network data to history (RX and TX separate in bytes)
      setNetworkHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            time: timeStr,
            rx: systemUsage.images_total,
            tx: systemUsage.containers_total,
          },
        ];

        return newHistory.slice(-120);
      });
    } catch (error) {
      console.error("Error collecting monitoring data:", error);
    }
  }, [getDockerSystemUsage]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (
      cpuHistory.length > 0 ||
      memoryHistory.length > 0 ||
      networkHistory.length > 0
    ) {
      saveToStorage({
        cpuHistory,
        memoryHistory,
        networkHistory,
        lastUpdate: lastUpdate || new Date(),
      });
    }
  }, [cpuHistory, memoryHistory, networkHistory, lastUpdate, saveToStorage]);

  const startMonitoring = useCallback(() => {
    if (!isMonitoring) {
      setIsMonitoring(true);

      // Collect initial data
      collectData();

      // Set up interval
      intervalRef.current = setInterval(collectData, 1000);
    }
  }, [isMonitoring, collectData]);

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
    setLastUpdate(null);

    // Clear from localStorage
    try {
      localStorage.removeItem("docker-monitoring-data");
    } catch (error) {
      console.error("Error clearing monitoring data from storage:", error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const value: MonitoringContextType = {
    cpuHistory,
    memoryHistory,
    networkHistory,
    currentSystemUsage,
    isMonitoring,
    dataPointsCount: Math.max(
      cpuHistory.length,
      memoryHistory.length,
      networkHistory.length,
    ),
    lastUpdate,
    startMonitoring,
    stopMonitoring,
    clearHistory,
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
    currentSystemUsage,
    dataPointsCount,
  } = useMonitoring();

  const formatMemoryValue = (bytes: number, unit: "MB" | "GB" = "MB") => {
    if (unit === "GB") {
      return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  };

  const formatNetworkValue = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
  };

  const getCpuMaxValue = () => {
    const cpuOnlineMax = currentSystemUsage.containers_total * 10;

    if (cpuHistory.length === 0) {
      return Math.min(100, cpuOnlineMax);
    }

    const historyMax = Math.max(...cpuHistory.map((point) => point.value));
    const maxValueWith10Percent = historyMax * 0.01;
    const maxValue = Math.min(maxValueWith10Percent, cpuOnlineMax);

    return Math.max(maxValue, 0.1);
  };

  const getMemoryMaxValue = () => {
    const memoryLimitMB = currentSystemUsage.containers_total * 100;

    if (memoryHistory.length === 0) {
      return memoryLimitMB > 0 ? memoryLimitMB : 1024;
    }

    const historyMax = Math.max(...memoryHistory.map((point) => point.value));
    const maxValueWith10Percent = historyMax + historyMax * 0.1;
    const maxValue = Math.min(maxValueWith10Percent, memoryLimitMB);

    return Math.max(maxValue, 100);
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
    currentSystemUsage,
    dataPointsCount,

    // Computed values
    cpuMaxValue: getCpuMaxValue(),
    memoryMaxValue: getMemoryMaxValue(),
    networkConfig: getNetworkConfig(),
    historyDuration: getHistoryDuration(),

    // Formatters
    formatMemoryValue,
    formatNetworkValue,

    // Titles
    cpuTitle: `Containers Running: ${currentSystemUsage.containers_running} | Total: ${currentSystemUsage.containers_total}`,
    memoryTitle: `Images: ${currentSystemUsage.images_total}`,
    networkTitle: `System: ${currentSystemUsage.system_info || "Docker via SSH"}`,
  };
}
