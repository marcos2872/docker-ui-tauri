import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import {
  FaTrash,
  FaSearch,
  FaPlus,
  FaSync,
  FaNetworkWired,
} from "react-icons/fa";
import { CreateNetworkModal } from "../../components/CreateNetworkModal";
import { ToastContainer, useToast } from "../../components/Toast";

interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  created: string;
  containers_count: number;
  is_system: boolean;
}

type FilterType = "all" | "custom" | "system";

export function Networks() {
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [filteredNetworks, setFilteredNetworks] = useState<NetworkInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { toasts, removeToast, showSuccess, showError } = useToast();

  const fetchNetworks = useCallback(async () => {
    try {
      setLoading(true);
      const networkList: NetworkInfo[] = await invoke(
        "ssh_docker_list_networks",
      );
      setNetworks(networkList);
    } catch (error) {
      console.error("Error fetching networks:", error);
      showError("Erro ao buscar networks");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchNetworks();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRemoveNetwork = async (networkId: string) => {
    const network = networks.find((net) => net.id === networkId);

    if (network?.is_system) {
      showError("Não é possível remover uma network do sistema");
      return;
    }

    if (network && network.containers_count > 0) {
      showError("Não é possível remover uma network com containers conectados");
      return;
    }

    try {
      await invoke("ssh_docker_remove_network", { networkId });
      showSuccess("Network removida com sucesso");
      await fetchNetworks();
    } catch (error) {
      console.error("Error removing network:", error);
      showError("Erro ao remover network");
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getNetworkTypeColor = (isSystem: boolean) => {
    return isSystem ? "text-yellow-400" : "text-green-400";
  };

  const getNetworkTypeDot = (isSystem: boolean) => {
    return isSystem ? "bg-yellow-400" : "bg-green-400";
  };

  const filterNetworks = useCallback(() => {
    let filtered = networks;

    // Apply type filter
    if (activeFilter !== "all") {
      filtered = filtered.filter((network) => {
        switch (activeFilter) {
          case "system":
            return network.is_system;
          case "custom":
            return !network.is_system;
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (network) =>
          network.name.toLowerCase().includes(query) ||
          network.driver.toLowerCase().includes(query) ||
          network.scope.toLowerCase().includes(query) ||
          network.id.toLowerCase().includes(query),
      );
    }

    setFilteredNetworks(filtered);
  }, [networks, activeFilter, searchQuery]);

  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  useEffect(() => {
    filterNetworks();
  }, [filterNetworks]);

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
  }: {
    onClick: () => void;
    icon: React.ComponentType<any>;
    className?: string;
    disabled?: boolean;
    title: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        disabled
          ? "bg-gray-600 text-gray-400 cursor-not-allowed"
          : `bg-gray-700 text-gray-300 hover:bg-gray-600 ${className}`
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  const getFilterCounts = () => {
    const system = networks.filter((net) => net.is_system).length;
    const custom = networks.filter((net) => !net.is_system).length;

    return { all: networks.length, system, custom };
  };

  const counts = getFilterCounts();

  return (
    <div className="flex flex-col w-full p-4 gap-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Networks</h1>
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
            Criar Network
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar networks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <FilterButton filter="all" label="Todas" count={counts.all} />
          <FilterButton
            filter="custom"
            label="Personalizadas"
            count={counts.custom}
          />
          <FilterButton filter="system" label="Sistema" count={counts.system} />
        </div>
      </div>

      {/* Networks List */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredNetworks.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 text-gray-400">
            <FaNetworkWired className="w-16 h-16 mb-4 text-gray-600" />
            <p className="text-xl mb-2">Nenhuma network encontrada</p>
            <p className="text-sm">
              {searchQuery
                ? "Tente ajustar sua busca ou filtros"
                : "Crie uma network para começar"}
            </p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed">
                <thead>
                  <tr className="bg-gray-700 border-b border-gray-600">
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-24">
                      Tipo
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-48">
                      Nome
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-24">
                      Driver
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-20">
                      Escopo
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-24">
                      Containers
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-64">
                      ID
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-32">
                      Criada
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-20">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {filteredNetworks.map((network) => (
                    <tr
                      key={network.id}
                      className="hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${getNetworkTypeDot(network.is_system)}`}
                          ></div>
                          <span
                            className={`text-sm font-medium ${getNetworkTypeColor(network.is_system)}`}
                          >
                            {network.is_system ? "Sistema" : "Custom"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white font-medium">
                          <span title={network.name} className="block truncate">
                            {network.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {network.driver}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {network.scope}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {network.containers_count > 0 ? (
                          <span className="text-blue-400">
                            {network.containers_count}
                          </span>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        <div className="w-full">
                          <span
                            title={network.id}
                            className="font-mono text-xs block truncate"
                          >
                            {network.id.substring(0, 12)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {formatDate(network.created)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <ActionButton
                            onClick={() => handleRemoveNetwork(network.id)}
                            icon={FaTrash}
                            className="hover:bg-red-600"
                            disabled={
                              network.is_system || network.containers_count > 0
                            }
                            title={
                              network.is_system
                                ? "Não é possível remover uma network do sistema"
                                : network.containers_count > 0
                                  ? "Não é possível remover uma network com containers conectados"
                                  : "Remover network"
                            }
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

      {/* Create Network Modal */}
      <CreateNetworkModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchNetworks();
        }}
        onShowSuccess={showSuccess}
        onShowError={showError}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}
