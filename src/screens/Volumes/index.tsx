import { useCallback, useEffect, useState } from "react";
import { FaTrash, FaSearch, FaPlus, FaSync, FaHdd } from "react-icons/fa";
import { CreateVolumeModal } from "../../components/CreateVolumeModal";
import { ToastContainer, useToast } from "../../components/Toast";
import { useDockerApi, VolumeInfo } from "../../hooks/useDockerApi";

interface ExtendedVolumeInfo extends VolumeInfo {
  created: string;
  containers_count: number;
}

type FilterType = "all" | "in_use" | "unused";

export function Volumes() {
  const [volumes, setVolumes] = useState<ExtendedVolumeInfo[]>([]);
  const [filteredVolumes, setFilteredVolumes] = useState<ExtendedVolumeInfo[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { toasts, removeToast, showSuccess, showError } = useToast();
  const { listVolumes, removeVolume } = useDockerApi();

  const fetchVolumes = useCallback(async () => {
    try {
      setLoading(true);
      const volumeList = await listVolumes();
      // Convert VolumeInfo to ExtendedVolumeInfo with default values
      const extendedVolumeList: ExtendedVolumeInfo[] = volumeList.map(
        (volume) => ({
          ...volume,
          created: new Date().toISOString(),
          containers_count: 0,
        }),
      );
      setVolumes(extendedVolumeList);
    } catch (error) {
      console.error("Error fetching volumes:", error);
      showError("Erro ao buscar volumes");
    } finally {
      setLoading(false);
    }
  }, [listVolumes]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchVolumes();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRemoveVolume = async (volumeName: string) => {
    const volume = volumes.find((vol) => vol.name === volumeName);

    if (volume && volume.containers_count > 0) {
      showError("Não é possível remover um volume em uso por containers");
      return;
    }

    try {
      await removeVolume(volumeName);
      showSuccess("Volume removido com sucesso");
      await fetchVolumes();
    } catch (error) {
      console.error("Error removing volume:", error);
      showError("Erro ao remover volume");
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

  const getUsageColor = (inUse: boolean) => {
    return inUse ? "text-green-400" : "text-gray-400";
  };

  const getUsageDot = (inUse: boolean) => {
    return inUse ? "bg-green-400" : "bg-gray-400";
  };

  useEffect(() => {
    fetchVolumes();
  }, [fetchVolumes]);

  useEffect(() => {
    let filtered = volumes;

    // Apply usage filter
    if (activeFilter !== "all") {
      filtered = filtered.filter((volume) => {
        switch (activeFilter) {
          case "in_use":
            return volume.containers_count > 0;
          case "unused":
            return volume.containers_count === 0;
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (volume) =>
          volume.name.toLowerCase().includes(query) ||
          volume.driver.toLowerCase().includes(query) ||
          volume.mountpoint.toLowerCase().includes(query),
      );
    }

    setFilteredVolumes(filtered);
  }, [volumes, activeFilter, searchQuery]);

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
    const inUse = volumes.filter((vol) => vol.containers_count > 0).length;
    const unused = volumes.filter((vol) => vol.containers_count === 0).length;

    return { all: volumes.length, in_use: inUse, unused };
  };

  const counts = getFilterCounts();

  return (
    <div className="flex flex-col w-full p-4 gap-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Volumes</h1>
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
            Criar Volume
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar volumes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <FilterButton filter="all" label="Todos" count={counts.all} />
          <FilterButton filter="in_use" label="Em Uso" count={counts.in_use} />
          <FilterButton filter="unused" label="Sem Uso" count={counts.unused} />
        </div>
      </div>

      {/* Volumes List */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredVolumes.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 text-gray-400">
            <FaHdd className="w-16 h-16 mb-4 text-gray-600" />
            <p className="text-xl mb-2">Nenhum volume encontrado</p>
            <p className="text-sm">
              {searchQuery
                ? "Tente ajustar sua busca ou filtros"
                : "Crie um volume para começar"}
            </p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed">
                <thead>
                  <tr className="bg-gray-700 border-b border-gray-600">
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-24">
                      Status
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-48">
                      Nome
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-20">
                      Driver
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-24">
                      Containers
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-64">
                      Mount Point
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-32">
                      Criado
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300 w-20">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {filteredVolumes.map((volume) => (
                    <tr
                      key={volume.name}
                      className="hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${getUsageDot(volume.containers_count > 0)}`}
                          ></div>
                          <span
                            className={`text-sm font-medium ${getUsageColor(volume.containers_count > 0)}`}
                          >
                            {volume.containers_count > 0 ? "Em uso" : "Sem uso"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white font-medium">
                          <span title={volume.name} className="block truncate">
                            {volume.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {volume.driver}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {volume.containers_count > 0 ? (
                          <span className="text-blue-400">
                            {volume.containers_count}
                          </span>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        <div className="w-full">
                          <span
                            title={volume.mountpoint}
                            className="font-mono text-xs block truncate"
                          >
                            {volume.mountpoint}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {formatDate(volume.created)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <ActionButton
                            onClick={() => handleRemoveVolume(volume.name)}
                            icon={FaTrash}
                            className="hover:bg-red-600"
                            disabled={volume.containers_count > 0}
                            title={
                              volume.containers_count > 0
                                ? "Não é possível remover um volume em uso"
                                : "Remover volume"
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

      {/* Create Volume Modal */}
      <CreateVolumeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchVolumes();
        }}
        onShowSuccess={showSuccess}
        onShowError={showError}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}
