import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { FaTrash, FaSearch, FaDownload, FaSync, FaImage } from "react-icons/fa";
import { PullImageModal } from "../../components/PullImageModal";
import { ToastContainer, useToast } from "../../components/Toast";

interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  created: number;
  size: number;
  containers: number;
  in_use: boolean;
}

type FilterType = "all" | "in_use" | "unused";

export function Images() {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [filteredImages, setFilteredImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPullModalOpen, setIsPullModalOpen] = useState(false);
  const { toasts, removeToast, showSuccess, showError } = useToast();

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const imageList: ImageInfo[] = await invoke("docker_list_images");
      setImages(imageList);
    } catch (error) {
      console.error("Error fetching images:", error);
      showError("Erro ao buscar imagens");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchImages();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRemoveImage = async (imageId: string) => {
    const image = images.find((img) => img.id === imageId);

    if (image?.in_use) {
      showError("Não é possível remover uma imagem em uso por containers");
      return;
    }

    try {
      await invoke("docker_remove_image", { imageId });
      showSuccess("Imagem removida com sucesso");
      await fetchImages();
    } catch (error) {
      console.error("Error removing image:", error);
      showError("Erro ao remover imagem");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSize = (bytes: number) => {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getImageName = (repository: string, tag: string) => {
    return tag ? `${repository}:${tag}` : repository;
  };

  const getUsageColor = (inUse: boolean) => {
    return inUse ? "text-green-400" : "text-gray-400";
  };

  const getUsageDot = (inUse: boolean) => {
    return inUse ? "bg-green-400" : "bg-gray-400";
  };

  const filterImages = useCallback(() => {
    let filtered = images;

    // Apply usage filter
    if (activeFilter !== "all") {
      filtered = filtered.filter((image) => {
        switch (activeFilter) {
          case "in_use":
            return image.in_use;
          case "unused":
            return !image.in_use;
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (image) =>
          image.repository.toLowerCase().includes(query) ||
          image.tag.toLowerCase().includes(query) ||
          image.id.toLowerCase().includes(query) ||
          getImageName(image.repository, image.tag)
            .toLowerCase()
            .includes(query),
      );
    }

    setFilteredImages(filtered);
  }, [images, activeFilter, searchQuery]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  useEffect(() => {
    filterImages();
  }, [filterImages]);

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
    const inUse = images.filter((img) => img.in_use).length;
    const unused = images.filter((img) => !img.in_use).length;

    return { all: images.length, in_use: inUse, unused };
  };

  const counts = getFilterCounts();

  return (
    <div className="flex flex-col w-full p-4 gap-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Imagens</h1>
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
            onClick={() => setIsPullModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            <FaDownload className="w-4 h-4" />
            Pull de Imagem
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar imagens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <FilterButton filter="all" label="Todas" count={counts.all} />
          <FilterButton filter="in_use" label="Em Uso" count={counts.in_use} />
          <FilterButton filter="unused" label="Sem Uso" count={counts.unused} />
        </div>
      </div>

      {/* Images List */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 text-gray-400">
            <FaImage className="w-16 h-16 mb-4 text-gray-600" />
            <p className="text-xl mb-2">Nenhuma imagem encontrada</p>
            <p className="text-sm">
              {searchQuery
                ? "Tente ajustar sua busca ou filtros"
                : "Faça pull de uma imagem para começar"}
            </p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-700 border-b border-gray-600">
                    <th className="px-6 py-4 text-sm font-medium text-gray-300">
                      Status
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300">
                      Repositório
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300">
                      Tag
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300">
                      Containers
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300">
                      Tamanho
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300">
                      Criada
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-300">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {filteredImages.map((image) => (
                    <tr
                      key={image.id}
                      className="hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${getUsageDot(image.in_use)}`}
                          ></div>
                          <span
                            className={`text-sm font-medium ${getUsageColor(image.in_use)}`}
                          >
                            {image.in_use ? "Em uso" : "Sem uso"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white font-medium">
                          {image.repository}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          {image.id.substring(0, 12)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {image.tag || "<none>"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {image.containers > 0 ? (
                          <span className="text-blue-400">
                            {image.containers}
                          </span>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {formatSize(image.size)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {formatDate(image.created)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <ActionButton
                            onClick={() => handleRemoveImage(image.id)}
                            icon={FaTrash}
                            className="hover:bg-red-600"
                            disabled={image.in_use}
                            title={
                              image.in_use
                                ? "Não é possível remover uma imagem em uso"
                                : "Remover imagem"
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

      {/* Pull Image Modal */}
      <PullImageModal
        isOpen={isPullModalOpen}
        onClose={() => setIsPullModalOpen(false)}
        onSuccess={() => {
          fetchImages();
        }}
        onShowSuccess={showSuccess}
        onShowError={showError}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}
