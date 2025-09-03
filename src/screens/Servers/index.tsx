import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FaPlus,
  FaServer,
  FaPlay,
  FaStop,
  FaTrash,
  FaSearch,
} from "react-icons/fa";
import { AddServerModal } from "../../components/AddServerModal";
import { ToastContainer, useToast } from "../../components/Toast";

interface ServerInfo {
  id: string;
  host: string;
  label: string;
  port: number;
  user: string;
  password: string;
  isConnected: boolean;
  lastConnected?: string;
}

interface ServerData {
  host: string;
  label: string;
  port: number;
  user: string;
  password: string;
}

export function Servers() {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [filteredServers, setFilteredServers] = useState<ServerInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [connectedServerId, setConnectedServerId] = useState<string | null>(
    null,
  );
  const [connectingServerId, setConnectingServerId] = useState<string | null>(
    null,
  );
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // Load servers from localStorage on component mount
  useEffect(() => {
    const savedServers = localStorage.getItem("docker-ui-servers");
    if (savedServers) {
      try {
        const parsedServers = JSON.parse(savedServers);
        setServers(parsedServers);
      } catch (error) {
        console.error("Error loading servers:", error);
      }
    }
  }, []);

  // Save servers to localStorage whenever servers change
  useEffect(() => {
    localStorage.setItem("docker-ui-servers", JSON.stringify(servers));
  }, [servers]);

  const filterServers = useCallback(() => {
    let filtered = servers;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (server) =>
          server.label.toLowerCase().includes(query) ||
          server.host.toLowerCase().includes(query) ||
          server.user.toLowerCase().includes(query),
      );
    }

    setFilteredServers(filtered);
  }, [servers, searchQuery]);

  useEffect(() => {
    filterServers();
  }, [filterServers]);

  const handleAddServer = (serverData: ServerData) => {
    const newServer: ServerInfo = {
      id: Date.now().toString(),
      ...serverData,
      isConnected: false,
    };

    setServers((prev) => [...prev, newServer]);
    showSuccess(`Servidor ${serverData.label} adicionado com sucesso`);
  };

  const handleConnectServer = async (server: ServerInfo) => {
    if (connectedServerId && connectedServerId !== server.id) {
      showError("Desconecte do servidor atual antes de conectar a outro");
      return;
    }

    setConnectingServerId(server.id);

    try {
      await invoke("connect_to_server", {
        host: server.host,
        port: server.port,
        user: server.user,
        password: server.password,
      });

      setServers((prev) =>
        prev.map((s) =>
          s.id === server.id
            ? {
                ...s,
                isConnected: true,
                lastConnected: new Date().toISOString(),
              }
            : s,
        ),
      );

      setConnectedServerId(server.id);
      showSuccess(`Conectado ao servidor ${server.label}`);
    } catch (error) {
      console.error("Error connecting to server:", error);
      showError(`Erro ao conectar: ${error}`);
    } finally {
      setConnectingServerId(null);
    }
  };

  const handleDisconnectServer = async (server: ServerInfo) => {
    setConnectingServerId(server.id);

    try {
      await invoke("disconnect_from_server");

      setServers((prev) =>
        prev.map((s) =>
          s.id === server.id ? { ...s, isConnected: false } : s,
        ),
      );

      setConnectedServerId(null);
      showSuccess(`Desconectado do servidor ${server.label}`);
    } catch (error) {
      console.error("Error disconnecting from server:", error);
      showError(`Erro ao desconectar: ${error}`);
    } finally {
      setConnectingServerId(null);
    }
  };

  const handleRemoveServer = (server: ServerInfo) => {
    if (server.isConnected) {
      showError("Desconecte do servidor antes de removê-lo");
      return;
    }

    if (
      !confirm(`Tem certeza que deseja remover o servidor "${server.label}"?`)
    ) {
      return;
    }

    setServers((prev) => prev.filter((s) => s.id !== server.id));
    showSuccess(`Servidor ${server.label} removido`);
  };

  const formatLastConnected = (dateString?: string) => {
    if (!dateString) return "Nunca";

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Nunca";
    }
  };

  const ActionButton = ({
    onClick,
    icon: Icon,
    className = "",
    disabled = false,
    title,
    children,
  }: {
    onClick: () => void;
    icon: React.ComponentType<any>;
    className?: string;
    disabled?: boolean;
    title: string;
    children?: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${
        disabled
          ? "bg-gray-600 text-gray-400 cursor-not-allowed"
          : `bg-gray-700 text-gray-300 hover:bg-gray-600 ${className}`
      }`}
    >
      <Icon className="w-3 h-3" />
      {children}
    </button>
  );

  return (
    <div className="flex flex-col w-full p-4 gap-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Servidores</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            <FaPlus className="w-4 h-4" />
            Adicionar Servidor
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar servidores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="text-sm text-gray-400">
          {connectedServerId ? (
            <span className="text-green-400">
              Conectado:{" "}
              {servers.find((s) => s.id === connectedServerId)?.label}
            </span>
          ) : (
            "Nenhum servidor conectado"
          )}
        </div>
      </div>

      {/* Servers List */}
      <div className="flex-1 overflow-hidden">
        {filteredServers.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-64 text-gray-400">
            <FaServer className="w-16 h-16 mb-4 text-gray-600" />
            <p className="text-xl mb-2">
              {searchQuery
                ? "Nenhum servidor encontrado"
                : "Nenhum servidor configurado"}
            </p>
            <p className="text-sm">
              {searchQuery
                ? "Tente ajustar sua busca"
                : "Adicione um servidor para começar"}
            </p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left table-fixed">
                <thead>
                  <tr className="bg-gray-700 border-b border-gray-600">
                    <th className="px-4 py-4 text-sm font-medium text-gray-300 w-20">
                      Status
                    </th>
                    <th className="px-4 py-4 text-sm font-medium text-gray-300 w-32">
                      Label
                    </th>
                    <th className="px-4 py-4 text-sm font-medium text-gray-300 w-32">
                      Host
                    </th>
                    <th className="px-2 py-4 text-sm font-medium text-gray-300 w-16">
                      Porta
                    </th>
                    <th className="px-2 py-4 text-sm font-medium text-gray-300 w-16">
                      User
                    </th>
                    <th className="px-2 py-4 text-sm font-medium text-gray-300 w-24">
                      Conexão
                    </th>
                    <th className="px-4 py-4 text-sm font-medium text-gray-300 w-36">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {filteredServers.map((server) => (
                    <tr
                      key={server.id}
                      className="hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              server.isConnected
                                ? "bg-green-400"
                                : "bg-gray-400"
                            }`}
                          ></div>
                          <span
                            className={`text-sm font-medium ${
                              server.isConnected
                                ? "text-green-400"
                                : "text-gray-400"
                            }`}
                          >
                            {server.isConnected ? "Conectado" : "Desconectado"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-white font-medium">
                          <span title={server.label} className="block truncate">
                            {server.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-300">
                          <span title={server.host} className="block truncate">
                            {server.host}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-4 text-sm text-gray-300">
                        {server.port}
                      </td>
                      <td className="px-2 py-4 text-sm text-gray-300">
                        {server.user}
                      </td>
                      <td className="px-2 py-4 text-sm text-gray-300">
                        {formatLastConnected(server.lastConnected)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          {server.isConnected ? (
                            <ActionButton
                              onClick={() => handleDisconnectServer(server)}
                              icon={FaStop}
                              className="hover:bg-red-600"
                              disabled={connectingServerId === server.id}
                              title="Desconectar do servidor"
                            >
                              {connectingServerId === server.id
                                ? "Desconectando..."
                                : "Desconectar"}
                            </ActionButton>
                          ) : (
                            <ActionButton
                              onClick={() => handleConnectServer(server)}
                              icon={FaPlay}
                              className="hover:bg-green-600"
                              disabled={
                                connectingServerId === server.id ||
                                connectedServerId !== null
                              }
                              title={
                                connectedServerId !== null
                                  ? "Desconecte do servidor atual antes de conectar"
                                  : "Conectar ao servidor"
                              }
                            >
                              {connectingServerId === server.id
                                ? "Conectando..."
                                : "Conectar"}
                            </ActionButton>
                          )}

                          <ActionButton
                            onClick={() => handleRemoveServer(server)}
                            icon={FaTrash}
                            className="hover:bg-red-600"
                            disabled={server.isConnected}
                            title={
                              server.isConnected
                                ? "Desconecte antes de remover"
                                : "Remover servidor"
                            }
                          >
                            Remover
                          </ActionButton>
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

      {/* Add Server Modal */}
      <AddServerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddServer}
        onShowSuccess={showSuccess}
        onShowError={showError}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}
