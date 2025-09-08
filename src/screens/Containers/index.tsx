import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import {
  FaPlay,
  FaStop,
  FaPause,
  FaTrash,
  FaSearch,
  FaPlus,
  FaSync,
  FaEye,
} from "react-icons/fa";
import { CreateContainerModal } from "../../components/CreateContainerModal";
import { ToastContainer, useToast } from "../../components/Toast";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { formatDate } from "../../utils/formatDate";

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: number[];
  created: number;
}

type FilterType = "all" | "running" | "stopped" | "paused";

export function Containers() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [filteredContainers, setFilteredContainers] = useState<ContainerInfo[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loadingActions, setLoadingActions] = useState<
    Record<string, string | null>
  >({});
  const { toasts, removeToast, showSuccess, showError } = useToast();

  const fetchContainers = useCallback(async () => {
    try {
      setLoading(true);
      const containerList: ContainerInfo[] = await invoke(
        "docker_list_containers",
      );
      setContainers(containerList);
    } catch (error) {
      console.error("Error fetching containers:", error);
      showError("Erro ao buscar containers");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchContainers();
    setTimeout(() => setIsRefreshing(false), 500);
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
        case "remove":
          command = "docker_remove_container";
          break;
        default:
          return;
      }

      await invoke(command, { containerId });
      await fetchContainers();

      const actionMessages = {
        start: "Container iniciado com sucesso",
        stop: "Container parado com sucesso",
        pause: "Container pausado com sucesso",
        unpause: "Container retomado com sucesso",
        remove: "Container removido com sucesso",
      };

      showSuccess(actionMessages[action as keyof typeof actionMessages]);
    } catch (error) {
      console.error(`Error performing ${action} on container:`, error);
      showError(
        `Erro ao ${action === "start" ? "iniciar" : action === "stop" ? "parar" : action === "pause" ? "pausar" : action === "unpause" ? "retomar" : "remover"} container`,
      );
    } finally {
      setLoadingActions((prev) => ({ ...prev, [containerId]: null }));
    }
  };

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

  const filterContainers = useCallback(() => {
    let filtered = containers;

    // Apply status filter
    if (activeFilter !== "all") {
      filtered = filtered.filter((container) => {
        switch (activeFilter) {
          case "running":
            return container.state.toLowerCase() === "running";
          case "stopped":
            return (
              container.state.toLowerCase() === "stopped" ||
              container.state.toLowerCase() === "exited"
            );
          case "paused":
            return container.state.toLowerCase() === "paused";
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (container) =>
          container.name.toLowerCase().includes(query) ||
          container.image.toLowerCase().includes(query) ||
          container.id.toLowerCase().includes(query),
      );
    }

    setFilteredContainers(filtered);
  }, [containers, activeFilter, searchQuery]);

  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);

  useEffect(() => {
    filterContainers();
  }, [filterContainers]);

  const FilterButton = ({
    filter,
    label,
    count,
  }: {
    filter: FilterType;
    label: string;
    count: number;
  }) => (
    <button
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        activeFilter === filter
          ? "bg-blue-600 text-white"
          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
      }`}
      onClick={() => setActiveFilter(filter)}
    >
      {label} ({count})
    </button>
  );

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
      className={`p-2 rounded-lg transition-colors w-9 h-9 flex items-center justify-center ${
        disabled || loading
          ? "bg-gray-600 text-gray-400 cursor-not-allowed"
          : `bg-gray-700 text-gray-300 hover:bg-gray-600 ${className}`
      }`}
    >
      {loading ? <LoadingSpinner size={16} /> : <Icon className="w-4 h-4" />}
    </button>
  );

  const getFilterCounts = () => {
    const running = containers.filter(
      (c) => c.state.toLowerCase() === "running",
    ).length;
    const stopped = containers.filter(
      (c) =>
        c.state.toLowerCase() === "stopped" ||
        c.state.toLowerCase() === "exited",
    ).length;
    const paused = containers.filter(
      (c) => c.state.toLowerCase() === "paused",
    ).length;

    return { all: containers.length, running, stopped, paused };
  };

  const counts = getFilterCounts();

  return (
    <div className="flex flex-col w-full p-4 gap-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Containers</h1>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <FaSync
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Atualizar
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            <FaPlus className="w-4 h-4" />
            Criar Container
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar containers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <FilterButton filter="all" label="Todos" count={counts.all} />
          <FilterButton
            filter="running"
            label="Rodando"
            count={counts.running}
          />
          <FilterButton
            filter="stopped"
            label="Parados"
            count={counts.stopped}
          />
          <FilterButton
            filter="paused"
            label="Pausados"
            count={counts.paused}
          />
        </div>
      </div>

      {/* Container List */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredContainers.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 text-gray-400">
            <p className="text-xl mb-2">Nenhum container encontrado</p>
            <p className="text-sm">
              {searchQuery
                ? "Tente ajustar sua busca ou filtros"
                : "Crie seu primeiro container para começar"}
            </p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed">
                <thead>
                  <tr className="bg-gray-700 border-b border-gray-600">
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-32">
                      Status
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-32">
                      Nome
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-32">
                      Imagem
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-28">
                      Portas
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-32">
                      Criado
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-60">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {filteredContainers.map((container) => (
                    <tr
                      key={container.id}
                      className="hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${getStatusDot(
                              container.state,
                            )}`}
                          ></div>
                          <span
                            className={`text-sm font-medium ${getStatusColor(
                              container.state,
                            )}`}
                          >
                            {container.state}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white font-medium">
                          <span
                            title={container.name}
                            className="block truncate"
                          >
                            {container.name}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          {container.id.substring(0, 12)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        <span
                          title={container.image}
                          className="block truncate"
                        >
                          {container.image}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        <span
                          title={
                            container.ports.length > 0
                              ? container.ports.join(", ")
                              : "N/A"
                          }
                          className="block truncate"
                        >
                          {container.ports.length > 0
                            ? container.ports.join(", ")
                            : "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        <span
                          title={formatDate(container.created)}
                          className="block truncate"
                        >
                          {formatDate(container.created)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {container.state.toLowerCase() === "running" ? (
                            <>
                              <ActionButton
                                onClick={() =>
                                  handleContainerAction(container.id, "stop")
                                }
                                icon={FaStop}
                                className="hover:bg-red-600"
                                title="Parar container"
                                loading={
                                  loadingActions[container.id] === "stop"
                                }
                              />
                              <ActionButton
                                onClick={() =>
                                  handleContainerAction(container.id, "pause")
                                }
                                icon={FaPause}
                                className="hover:bg-yellow-600"
                                title="Pausar container"
                                loading={
                                  loadingActions[container.id] === "pause"
                                }
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
                                title="Retomar container"
                                loading={
                                  loadingActions[container.id] === "unpause"
                                }
                              />
                              <ActionButton
                                onClick={() =>
                                  handleContainerAction(container.id, "stop")
                                }
                                icon={FaStop}
                                className="hover:bg-red-600"
                                title="Parar container"
                                loading={
                                  loadingActions[container.id] === "stop"
                                }
                              />
                            </>
                          ) : (
                            <ActionButton
                              onClick={() =>
                                handleContainerAction(container.id, "start")
                              }
                              icon={FaPlay}
                              className="hover:bg-green-600"
                              title="Iniciar container"
                              loading={loadingActions[container.id] === "start"}
                            />
                          )}

                          <ActionButton
                            onClick={() =>
                              console.log("View logs:", container.id)
                            }
                            icon={FaEye}
                            className="hover:bg-blue-600"
                            title="Ver logs"
                          />

                          <ActionButton
                            onClick={() =>
                              handleContainerAction(container.id, "remove")
                            }
                            icon={FaTrash}
                            className="hover:bg-red-600"
                            disabled={
                              container.state.toLowerCase() === "running"
                            }
                            title={
                              container.state.toLowerCase() === "running"
                                ? "Pare o container antes de removê-lo"
                                : "Remover container"
                            }
                            loading={loadingActions[container.id] === "remove"}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Container Modal */}
      <CreateContainerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchContainers();
        }}
        onShowSuccess={showSuccess}
        onShowError={showError}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}
