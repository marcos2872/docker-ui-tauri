import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FaArrowLeft,
  FaPlay,
  FaStop,
  FaPause,
  FaSync,
  FaRedo,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import { Chart } from "react-google-charts";
import { LoadingSpinner } from "../LoadingSpinner";
import { Header } from "../Header";
import { ToastContainer, useToast } from "../Toast";
import { formatDate } from "../../utils/formatDate";

interface ContainerDetailsInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: number[];
  created: number;
  command: string;
  platform: string;
  size_rw?: number;
  size_root_fs?: number;
}

interface ContainerDetailsProps {
  containerId: string;
  onBack: () => void;
}

export function ContainerDetails({
  containerId,
  onBack,
}: ContainerDetailsProps) {
  const [container, setContainer] = useState<ContainerDetailsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [cpuExpanded, setCpuExpanded] = useState(false);
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [cpuData, setCpuData] = useState<[string, number][]>([]);
  const [memoryData, setMemoryData] = useState<[string, number][]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingActions, setLoadingActions] = useState<
    Record<string, string | null>
  >({});
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const fetchContainerDetails = async () => {
    try {
      setLoading(true);
      const details: ContainerDetailsInfo = await invoke(
        "docker_get_container",
        {
          containerId: containerId,
        },
      );
      console.log(details);
      setContainer(details);
    } catch (error) {
      console.error("Error fetching container details:", error);
      showError("Erro ao buscar detalhes do container");
    } finally {
      setLoading(false);
    }
  };

  const scrollLogsToBottom = () => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop =
        logsContainerRef.current.scrollHeight;
    }
  };

  const fetchContainerStats = async () => {
    if (container?.state.toLowerCase() !== "running") {
      return;
    }

    try {
      setLoadingStats(true);
      const stats: [number, number] = await invoke(
        "docker_get_container_stats_for_graph",
        {
          containerId: containerId,
        },
      );

      const [cpuPercent, memoryPercent] = stats;
      const now = new Date();
      const timeStr = now.toLocaleTimeString();

      // Adiciona novos dados mantendo apenas os últimos 20 pontos
      setCpuData((prev) => {
        const newData = [
          ...prev,
          [timeStr, Math.round(cpuPercent * 100) / 100],
        ];
        return newData.slice(-20);
      });

      setMemoryData((prev) => {
        const newData = [
          ...prev,
          [timeStr, Math.round(memoryPercent * 100) / 100],
        ];
        return newData.slice(-20);
      });
    } catch (error) {
      console.error("Error fetching container stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchContainerLogs = async () => {
    try {
      setLoadingLogs(true);
      const containerLogs: string = await invoke("docker_get_container_logs", {
        containerId: containerId,
      });
      setLogs(containerLogs);
      // Scroll para o final após carregar os logs
      setTimeout(scrollLogsToBottom, 100);
    } catch (error) {
      console.error("Error fetching container logs:", error);
      showError("Erro ao buscar logs do container");
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchContainerDetails(), fetchContainerLogs()]);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleContainerAction = async (containerId: string, action: string) => {
    setLoadingActions((prev) => ({ ...prev, [containerId]: action }));
    try {
      let command = "";
      switch (action) {
        case "start":
          command = "docker_start_container";
          break;
        case "stop":
          command = "docker_stop_container";
          break;
        case "pause":
          command = "docker_pause_container";
          break;
        case "unpause":
          command = "docker_unpause_container";
          break;
        case "restart":
          command = "docker_restart_container";
          break;
        default:
          return;
      }

      await invoke(command, { containerId });
      await fetchContainerDetails();

      const actionMessages = {
        start: "Container iniciado com sucesso",
        stop: "Container parado com sucesso",
        pause: "Container pausado com sucesso",
        unpause: "Container retomado com sucesso",
        restart: "Container reiniciado com sucesso",
        remove: "Container removido com sucesso",
      };

      showSuccess(actionMessages[action as keyof typeof actionMessages]);
    } catch (error) {
      console.error(`Error performing ${action} on container:`, error);
      showError(
        `Erro ao ${action === "start" ? "iniciar" : action === "stop" ? "parar" : action === "pause" ? "pausar" : action === "unpause" ? "retomar" : action === "restart" ? "reiniciar" : "remover"} container`,
      );
    } finally {
      setLoadingActions((prev) => ({ ...prev, [containerId]: null }));
    }
  };

  useEffect(() => {
    fetchContainerDetails();
    fetchContainerLogs();
  }, [containerId]);

  // Busca stats em tempo real se o container estiver rodando
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (container?.state.toLowerCase() === "running") {
      // Busca stats iniciais
      fetchContainerStats();

      // Atualiza a cada 3 segundos
      interval = setInterval(fetchContainerStats, 3000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [container?.state, containerId]);

  const getStatusColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "running":
        return "text-green-400";
      case "stopped":
      case "exited":
        return "text-red-400";
      case "paused":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusDot = (state: string) => {
    switch (state.toLowerCase()) {
      case "running":
        return "bg-green-400";
      case "stopped":
      case "exited":
        return "bg-red-400";
      case "paused":
        return "bg-yellow-400";
      default:
        return "bg-gray-400";
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "N/A";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  };

  const ActionButton = ({
    onClick,
    icon: Icon,
    className = "",
    disabled = false,
    title,
    loading = false,
  }: {
    onClick: () => void;
    icon: React.ComponentType<any>;
    className?: string;
    disabled?: boolean;
    title: string;
    loading?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        disabled || loading
          ? "bg-gray-600 text-gray-400 cursor-not-allowed"
          : `bg-gray-700 text-gray-300 hover:bg-gray-600 ${className}`
      }`}
    >
      {loading ? <LoadingSpinner size={16} /> : <Icon className="w-4 h-4" />}
      <span className="text-sm font-medium">{title}</span>
    </button>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!container) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 text-xl mb-4">
              Container não encontrado
            </p>
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              <FaArrowLeft className="w-4 h-4" />
              Voltar à lista
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Window Header */}
      <Header />

      {/* Fixed Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <FaArrowLeft className="w-4 h-4" />
                Voltar à lista
              </button>
              <h1 className="text-2xl font-bold text-white">
                Detalhes do Container
              </h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <FaSync
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          {/* Container Info */}
          <div className="grid gap-6">
            {/* Main Container Card - Similar to list view */}
            <div className="bg-gray-800 rounded-lg p-6">
              {/* Status Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full ${getStatusDot(container.state)}`}
                  ></div>
                  <h2 className="text-xl font-semibold text-white">
                    {container.name}
                  </h2>
                  <span
                    className={`text-sm font-medium ${getStatusColor(container.state)}`}
                  >
                    {container.state}
                  </span>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  {container.state.toLowerCase() === "running" ? (
                    <>
                      <ActionButton
                        onClick={() =>
                          handleContainerAction(container.id, "stop")
                        }
                        icon={FaStop}
                        className="hover:bg-red-600"
                        title="Parar"
                        loading={loadingActions[container.id] === "stop"}
                      />
                      <ActionButton
                        onClick={() =>
                          handleContainerAction(container.id, "pause")
                        }
                        icon={FaPause}
                        className="hover:bg-yellow-600"
                        title="Pausar"
                        loading={loadingActions[container.id] === "pause"}
                      />
                      <ActionButton
                        onClick={() =>
                          handleContainerAction(container.id, "restart")
                        }
                        icon={FaRedo}
                        className="hover:bg-blue-600"
                        title="Reiniciar"
                        loading={loadingActions[container.id] === "restart"}
                      />
                    </>
                  ) : container.state.toLowerCase() === "paused" ? (
                    <>
                      <ActionButton
                        onClick={() =>
                          handleContainerAction(container.id, "unpause")
                        }
                        icon={FaPlay}
                        className="hover:bg-green-600"
                        title="Retomar"
                        loading={loadingActions[container.id] === "unpause"}
                      />
                      <ActionButton
                        onClick={() =>
                          handleContainerAction(container.id, "stop")
                        }
                        icon={FaStop}
                        className="hover:bg-red-600"
                        title="Parar"
                        loading={loadingActions[container.id] === "stop"}
                      />
                    </>
                  ) : (
                    <ActionButton
                      onClick={() =>
                        handleContainerAction(container.id, "start")
                      }
                      icon={FaPlay}
                      className="hover:bg-green-600"
                      title="Iniciar"
                      loading={loadingActions[container.id] === "start"}
                    />
                  )}
                </div>
              </div>

              {/* Container Details Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Informações Básicas
                  </h3>
                  <div>
                    <span className="text-gray-400 text-sm">Nome:</span>
                    <p className="text-white font-medium">{container.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Imagem:</span>
                    <p className="text-white">{container.image}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Status:</span>
                    <p
                      className={`font-medium ${getStatusColor(container.state)}`}
                    >
                      {container.status}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Criado:</span>
                    <p className="text-white">
                      {formatDate(container.created)}
                    </p>
                  </div>
                </div>

                {/* Technical Details */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Detalhes Técnicos
                  </h3>
                  <div>
                    <span className="text-gray-400 text-sm">ID:</span>
                    <p className="text-white font-mono text-sm break-all">
                      {container.id}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Comando:</span>
                    <p className="text-white font-mono text-sm">
                      {container.command || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Plataforma:</span>
                    <p className="text-white">{container.platform || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Portas:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {container.ports.length > 0 ? (
                        [...container.ports]
                          .sort((a, b) => a - b)
                          .reduce((pairs, _port, index, arr) => {
                            if (index % 2 === 0) {
                              const hostPort = arr[index];
                              const containerPort = arr[index + 1];
                              if (containerPort !== undefined) {
                                pairs.push(`${hostPort}:${containerPort}`);
                              } else {
                                pairs.push(`${hostPort}:${hostPort}`);
                              }
                            }
                            return pairs;
                          }, [] as string[])
                          .map((portPair, index) => (
                            <span
                              key={`port-${index}`}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                            >
                              {portPair}
                            </span>
                          ))
                      ) : (
                        <span className="text-gray-400 text-sm">
                          Nenhuma porta exposta
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Storage - Additional Info */}
            {(container.size_rw || container.size_root_fs) && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Armazenamento
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {container.size_rw && (
                    <div>
                      <span className="text-gray-400 text-sm">
                        Tamanho (RW):
                      </span>
                      <p className="text-white">
                        {formatBytes(container.size_rw)}
                      </p>
                    </div>
                  )}
                  {container.size_root_fs && (
                    <div>
                      <span className="text-gray-400 text-sm">
                        Tamanho (Root FS):
                      </span>
                      <p className="text-white">
                        {formatBytes(container.size_root_fs)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CPU Usage Graph */}
            {container.state.toLowerCase() === "running" && (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-750 transition-colors border-b border-gray-700"
                  onClick={() => setCpuExpanded(!cpuExpanded)}
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">
                      Uso de CPU
                    </h3>
                    {cpuExpanded ? (
                      <FaChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <FaChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {cpuData.length > 0 && (
                      <span className="text-sm text-gray-400">
                        {cpuData[cpuData.length - 1][1]}%
                      </span>
                    )}
                    {loadingStats && <LoadingSpinner size={16} />}
                  </div>
                </div>

                {cpuExpanded && (
                  <div className="p-4 pt-0">
                    <div className="bg-white rounded-lg p-4 h-[300px]">
                      {cpuData.length > 0 ? (
                        <Chart
                          chartType="LineChart"
                          data={[["Tempo", "CPU (%)"], ...cpuData]}
                          options={{
                            title: "Uso de CPU em Tempo Real",
                            titleTextStyle: { color: "#1f2937" },
                            hAxis: {
                              title: "Tempo",
                              titleTextStyle: { color: "#6b7280" },
                              textStyle: { color: "#6b7280" },
                            },
                            vAxis: {
                              title: "Percentual (%)",
                              titleTextStyle: { color: "#6b7280" },
                              textStyle: { color: "#6b7280" },
                              minValue: 0,
                              maxValue: 100,
                            },
                            backgroundColor: "white",
                            colors: ["#3b82f6"],
                            legend: { position: "none" },
                            chartArea: { width: "85%", height: "75%" },
                            animation: {
                              duration: 1000,
                              easing: "out",
                            },
                          }}
                          width="100%"
                          height="300px"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          <p>Coletando dados de CPU...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Memory Usage Graph */}
            {container.state.toLowerCase() === "running" && (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-750 transition-colors border-b border-gray-700"
                  onClick={() => setMemoryExpanded(!memoryExpanded)}
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">
                      Uso de Memória
                    </h3>
                    {memoryExpanded ? (
                      <FaChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <FaChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {memoryData.length > 0 && (
                      <span className="text-sm text-gray-400">
                        {memoryData[memoryData.length - 1][1]}%
                      </span>
                    )}
                    {loadingStats && <LoadingSpinner size={16} />}
                  </div>
                </div>

                {memoryExpanded && (
                  <div className="p-4 pt-0">
                    <div className="bg-white rounded-lg p-4 h-[300px]">
                      {memoryData.length > 0 ? (
                        <Chart
                          chartType="LineChart"
                          data={[["Tempo", "Memória (%)"], ...memoryData]}
                          options={{
                            title: "Uso de Memória em Tempo Real",
                            titleTextStyle: { color: "#1f2937" },
                            hAxis: {
                              title: "Tempo",
                              titleTextStyle: { color: "#6b7280" },
                              textStyle: { color: "#6b7280" },
                            },
                            vAxis: {
                              title: "Percentual (%)",
                              titleTextStyle: { color: "#6b7280" },
                              textStyle: { color: "#6b7280" },
                              minValue: 0,
                              maxValue: 100,
                            },
                            backgroundColor: "white",
                            colors: ["#10b981"],
                            legend: { position: "none" },
                            chartArea: { width: "85%", height: "75%" },
                            animation: {
                              duration: 1000,
                              easing: "out",
                            },
                          }}
                          width="100%"
                          height="300px"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          <p>Coletando dados de memória...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Container Logs */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              {/* Logs Header - Always Visible */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-750 transition-colors border-b border-gray-700"
                onClick={() => {
                  setLogsExpanded(!logsExpanded);
                  if (!logsExpanded && logs) {
                    // Scroll para baixo quando expandir e já tiver logs
                    setTimeout(scrollLogsToBottom, 100);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">
                    Logs (últimas 100 linhas)
                  </h3>
                  {logsExpanded ? (
                    <FaChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <FaChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchContainerLogs();
                  }}
                  disabled={loadingLogs}
                  className="flex items-center gap-2 px-3 py-1 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  <FaSync
                    className={`w-3 h-3 ${loadingLogs ? "animate-spin" : ""}`}
                  />
                  {loadingLogs ? "Carregando..." : "Atualizar"}
                </button>
              </div>

              {/* Logs Content - Collapsible */}
              {logsExpanded && (
                <div className="p-4 pt-0">
                  <div
                    ref={logsContainerRef}
                    className="bg-black rounded-lg p-4 h-[500px] overflow-y-auto font-mono text-sm"
                  >
                    {loadingLogs ? (
                      <div className="flex items-center justify-center h-full">
                        <LoadingSpinner size={24} />
                      </div>
                    ) : logs ? (
                      <pre className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {logs}
                      </pre>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <p>Nenhum log disponível</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}
