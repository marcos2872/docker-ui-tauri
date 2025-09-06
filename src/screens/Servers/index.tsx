import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FaPlus,
  FaServer,
  FaPlay,
  FaStop,
  FaTrash,
  FaSearch,
  FaTerminal,
  FaSync,
  FaEdit,
} from "react-icons/fa";
import { AddServerModal } from "../../components/AddServerModal";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ToastContainer, useToast } from "../../components/Toast";
import { useDockerConnection } from "../../contexts/DockerConnectionContext";

// Local interface for the list of SAVED servers
interface ServerInfo {
  id: string;
  host: string;
  label: string;
  port: number;
  user: string;
}

interface ServerData {
  host: string;
  label: string;
  port: number;
  user: string;
  password?: string;
}

interface CommandExecutionModal {
  isOpen: boolean;
  server?: ServerInfo;
}

interface EditServerModal {
  isOpen: boolean;
  server?: ServerInfo;
}

export function Servers() {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [filteredServers, setFilteredServers] = useState<ServerInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [commandModal, setCommandModal] = useState<CommandExecutionModal>({
    isOpen: false,
  });
  const [editModal, setEditModal] = useState<EditServerModal>({
    isOpen: false,
  });
  const [command, setCommand] = useState("");
  const [commandOutput, setCommandOutput] = useState("");
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const { toasts, removeToast, showSuccess, showError } = useToast();

  const {
    connectToSsh,
    disconnectFromSsh,
    currentSshConnection,
    isConnecting,
    connectionError,
    refreshSshConnections,
    availableSshConnections,
  } = useDockerConnection();

  useEffect(() => {
    const serversFromSaved = availableSshConnections.map((conn) => ({
      id: `${conn.host}:${conn.port}:${conn.username}`,
      host: conn.host,
      label: conn.name || `${conn.username}@${conn.host}:${conn.port}`,
      port: conn.port,
      user: conn.username,
    }));
    setServers(serversFromSaved);
  }, [availableSshConnections]);

  useEffect(() => {
    if (connectionError) {
      showError(connectionError);
    }
  }, [connectionError, showError]);

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

  const handleAddServer = async (serverData: ServerData) => {
    try {
      await invoke<string>("ssh_add_saved_connection", {
        host: serverData.host,
        port: serverData.port,
        username: serverData.user,
        name: serverData.label,
        password: serverData.password || null,
      });
      await refreshSshConnections();
      showSuccess(`Servidor ${serverData.label} adicionado com sucesso`);
    } catch (error) {
      console.error("Error adding server:", error);
      showError(`Erro ao adicionar servidor: ${error}`);
    }
  };

  const handleConnectServer = async (server: ServerInfo) => {
    const connectionInfo = availableSshConnections.find(
      (c) =>
        c.host === server.host &&
        c.port === server.port &&
        c.username === server.user,
    );

    let password = "";

    // Check if password is saved
    if (connectionInfo?.password) {
      password = connectionInfo.password;
    } else {
      const promptPassword = prompt(
        `Digite a senha para ${server.user}@${server.host}:`,
      );
      if (promptPassword === null) return;
      password = promptPassword;
    }

    if (connectionInfo) {
      const success = await connectToSsh(connectionInfo, password);
      if (success) {
        showSuccess(`Conectado ao servidor ${server.label}`);
      }
    }
  };

  const handleDisconnectServer = async () => {
    await disconnectFromSsh();
    showSuccess("Desconectado com sucesso.");
  };

  const handleRemoveServer = async (server: ServerInfo) => {
    const isConnected =
      currentSshConnection?.host === server.host &&
      currentSshConnection?.port === server.port &&
      currentSshConnection?.username === server.user;

    if (isConnected) {
      showError("Desconecte do servidor antes de removê-lo");
      return;
    }

    if (
      !confirm(`Tem certeza que deseja remover o servidor "${server.label}"?`)
    ) {
      return;
    }

    setLoadingActions((prev) => ({ ...prev, [server.id]: true }));
    try {
      await invoke<string>("ssh_remove_saved_connection", {
        host: server.host,
        port: server.port,
        username: server.user,
      });
      await refreshSshConnections();
      showSuccess(`Servidor ${server.label} removido`);
    } catch (error) {
      console.error("Error removing server:", error);
      showError(`Erro ao remover servidor: ${error}`);
    } finally {
      setLoadingActions((prev) => ({ ...prev, [server.id]: false }));
    }
  };

  const handleOpenCommandModal = (server: ServerInfo) => {
    const isConnected =
      currentSshConnection?.host === server.host &&
      currentSshConnection?.port === server.port &&
      currentSshConnection?.username === server.user;

    if (!isConnected) {
      showError("Servidor não está conectado");
      return;
    }
    setCommandModal({ isOpen: true, server });
    setCommand("");
    setCommandOutput("");
  };

  const handleCloseCommandModal = () => {
    setCommandModal({ isOpen: false });
    setCommand("");
    setCommandOutput("");
  };

  const handleOpenEditModal = (server: ServerInfo) => {
    setEditModal({ isOpen: true, server });
    setEditingName(server.label);
  };

  const handleCloseEditModal = () => {
    setEditModal({ isOpen: false });
    setEditingName("");
  };

  const handleUpdateServerName = async () => {
    if (!editModal.server || !editingName.trim()) {
      showError("Nome não pode estar vazio");
      return;
    }

    try {
      await invoke<string>("ssh_update_saved_connection_name", {
        host: editModal.server.host,
        port: editModal.server.port,
        username: editModal.server.user,
        name: editingName.trim(),
      });
      await refreshSshConnections();
      handleCloseEditModal();
      showSuccess("Nome da conexão atualizado com sucesso");
    } catch (error) {
      console.error("Error updating server name:", error);
      showError(`Erro ao atualizar nome: ${error}`);
    }
  };

  const handleExecuteCommand = async () => {
    if (!commandModal.server || !command.trim() || !currentSshConnection) {
      showError("Conexão ou comando inválido");
      return;
    }

    setIsExecutingCommand(true);

    try {
      const output = await invoke<string>("ssh_execute_command", {
        connectionId: currentSshConnection.id,
        command: command.trim(),
      });

      setCommandOutput(output);
      showSuccess("Comando executado com sucesso");
    } catch (error) {
      setCommandOutput(`Erro: ${error}`);
      showError(`Erro ao executar comando: ${error}`);
    } finally {
      setIsExecutingCommand(false);
    }
  };

  const ActionButton = ({
    onClick,
    icon: Icon,
    className = "",
    disabled = false,
    title,
    children,
    loading = false,
  }: {
    onClick: () => void;
    icon: React.ComponentType<any>;
    className?: string;
    disabled?: boolean;
    title: string;
    children?: React.ReactNode;
    loading?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${
        disabled || loading
          ? "bg-gray-600 text-gray-400 cursor-not-allowed"
          : `bg-gray-700 text-gray-300 hover:bg-gray-600 ${className}`
      }`}
    >
      {loading ? <LoadingSpinner size={12} /> : <Icon className="w-3 h-3" />}
      {children}
    </button>
  );

  const QuickCommandButton = ({
    label,
    command: cmd,
  }: {
    label: string;
    command: string;
  }) => (
    <button
      onClick={() => setCommand(cmd)}
      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500 transition-colors"
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col w-full p-4 gap-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Servidores SSH</h1>
        <div className="flex gap-2">
          <button
            onClick={refreshSshConnections}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
            title="Atualizar conexões salvas"
          >
            <FaSync className="w-4 h-4" />
            Atualizar
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            <FaPlus className="w-4 h-4" />
            Adicionar Servidor
          </button>
        </div>
      </div>

      {/* Search and Status */}
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
        <div className="flex gap-4 text-sm text-gray-400">
          <span className="text-blue-400">
            {availableSshConnections.length} servidor(es) salvo(s)
          </span>
          <span className="text-green-400">
            {currentSshConnection ? "1 conexão ativa" : "Nenhuma conexão ativa"}
          </span>
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
                    <th className="px-4 py-4 text-sm font-medium text-gray-300 w-28">
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
                    <th className="px-4 py-4 text-sm font-medium text-gray-300 w-48">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {filteredServers.map((server) => {
                    const isConnected =
                      currentSshConnection?.host === server.host &&
                      currentSshConnection?.port === server.port &&
                      currentSshConnection?.username === server.user;

                    return (
                      <tr
                        key={server.id}
                        className="hover:bg-gray-700 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                isConnected ? "bg-green-400" : "bg-gray-400"
                              }`}
                            ></div>
                            <span
                              className={`text-sm font-medium ${
                                isConnected ? "text-green-400" : "text-gray-400"
                              }`}
                            >
                              {isConnected ? "Conectado" : "Desconectado"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-white font-medium">
                            <span
                              title={server.label}
                              className="block truncate"
                            >
                              {server.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-300">
                            <span
                              title={server.host}
                              className="block truncate"
                            >
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
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 flex-wrap">
                            {!isConnected ? (
                              <ActionButton
                                onClick={() => handleConnectServer(server)}
                                icon={FaPlay}
                                className="hover:bg-green-600"
                                disabled={isConnecting}
                                title="Conectar ao servidor"
                              >
                                {isConnecting ? "Conectando..." : "Conectar"}
                              </ActionButton>
                            ) : (
                              <>
                                <ActionButton
                                  onClick={() => handleOpenCommandModal(server)}
                                  icon={FaTerminal}
                                  className="hover:bg-blue-600"
                                  title="Executar comandos"
                                >
                                  Terminal
                                </ActionButton>
                                <ActionButton
                                  onClick={handleDisconnectServer}
                                  icon={FaStop}
                                  className="hover:bg-red-600"
                                  disabled={isConnecting}
                                  title="Desconectar do servidor"
                                >
                                  {isConnecting
                                    ? "Desconectando..."
                                    : "Desconectar"}
                                </ActionButton>
                              </>
                            )}

                            <ActionButton
                              onClick={() => handleOpenEditModal(server)}
                              icon={FaEdit}
                              className="hover:bg-yellow-600"
                              title="Editar nome da conexão"
                            >
                              Editar
                            </ActionButton>

                            <ActionButton
                              onClick={() => handleRemoveServer(server)}
                              icon={FaTrash}
                              className="hover:bg-red-600"
                              disabled={isConnected}
                              title={
                                isConnected
                                  ? "Desconecte antes de remover"
                                  : "Remover servidor"
                              }
                              loading={loadingActions[server.id]}
                            >
                              Remover
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Command Execution Modal */}
      {commandModal.isOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                Terminal - {commandModal.server?.label} (
                {commandModal.server?.host})
              </h2>
              <button
                onClick={handleCloseCommandModal}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            {/* Quick Commands */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Comandos Rápidos:
              </h3>
              <div className="flex flex-wrap gap-2">
                <QuickCommandButton label="Usuário Atual" command="whoami" />
                <QuickCommandButton label="Diretório Atual" command="pwd" />
                <QuickCommandButton label="Listar Arquivos" command="ls -la" />
                <QuickCommandButton label="Uso do Disco" command="df -h" />
                <QuickCommandButton label="Memória" command="free -h" />
                <QuickCommandButton
                  label="Processos"
                  command="ps aux | head -10"
                />
                <QuickCommandButton label="Sistema" command="uname -a" />
                <QuickCommandButton label="Uptime" command="uptime" />
              </div>
            </div>

            {/* Command Input */}
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Digite um comando (ex: ls -la, whoami, pwd)"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" &&
                    !isExecutingCommand &&
                    handleExecuteCommand()
                  }
                  className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleExecuteCommand}
                  disabled={!command.trim() || isExecutingCommand}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isExecutingCommand ? "Executando..." : "Executar"}
                </button>
              </div>
            </div>

            {/* Command Output */}
            {commandOutput && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">
                  Resultado:
                </h3>
                <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-sm max-h-96 overflow-y-auto whitespace-pre-wrap font-mono">
                  {commandOutput}
                </pre>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleCloseCommandModal}
                className="text-gray-400 hover:text-white text-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Server Name Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                Editar Nome da Conexão
              </h2>
              <button
                onClick={handleCloseEditModal}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">
                Servidor: {editModal.server?.user}@{editModal.server?.host}:
                {editModal.server?.port}
              </p>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome da Conexão:
              </label>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyPress={(e) =>
                  e.key === "Enter" && handleUpdateServerName()
                }
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Digite o novo nome..."
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleCloseEditModal}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateServerName}
                disabled={!editingName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

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
