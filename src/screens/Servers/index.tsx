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
  FaEye,
  FaSync,
  FaEdit,
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
  connectionId?: string;
  lastConnected?: string;
}

interface ServerData {
  host: string;
  label: string;
  port: number;
  user: string;
}

interface SavedSshConnection {
  host: string;
  port: number;
  username: string;
  name?: string;
}

interface SshConnectionInfo {
  host: string;
  port: number;
  username: string;
  connection_id: string;
  connected_at: number;
  last_activity: number;
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
  const [sshConnections, setSshConnections] = useState<SshConnectionInfo[]>([]);
  const [savedConnections, setSavedConnections] = useState<
    SavedSshConnection[]
  >([]);
  const [connectingServerId, setConnectingServerId] = useState<string | null>(
    null,
  );
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
  const { toasts, removeToast, showSuccess, showError } = useToast();

  // Load servers from saved connections and active SSH connections on component mount
  useEffect(() => {
    loadSavedConnections();
    loadSshConnections();
  }, []);

  // Load saved connections from backend
  const loadSavedConnections = async () => {
    try {
      const connections = await invoke<SavedSshConnection[]>(
        "ssh_get_saved_connections",
      );
      setSavedConnections(connections);

      // Convert saved connections to server format
      const servers = connections.map((conn, index) => ({
        id: `${conn.host}:${conn.port}:${conn.username}`,
        host: conn.host,
        label: conn.name || `${conn.username}@${conn.host}:${conn.port}`,
        port: conn.port,
        user: conn.username,
        password: "", // Password is never saved
        isConnected: false,
      }));

      setServers(servers);
    } catch (error) {
      console.error("Error loading saved connections:", error);
      showError("Erro ao carregar conexões salvas");
    }
  };

  // Update server connection status based on SSH connections
  useEffect(() => {
    setServers((prevServers) =>
      prevServers.map((server) => {
        const connection = sshConnections.find(
          (conn) =>
            conn.host === server.host &&
            conn.port === server.port &&
            conn.username === server.user,
        );

        return {
          ...server,
          isConnected: !!connection,
          connectionId: connection?.connection_id,
          lastConnected: connection
            ? new Date(connection.connected_at * 1000).toISOString()
            : server.lastConnected,
        };
      }),
    );
  }, [sshConnections]);

  const loadSshConnections = async () => {
    try {
      const connections = await invoke<SshConnectionInfo[]>(
        "ssh_list_connections",
      );
      setSshConnections(connections);
    } catch (error) {
      console.error("Error loading SSH connections:", error);
    }
  };

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
      // Save connection to backend (without password)
      await invoke<string>("ssh_add_saved_connection", {
        host: serverData.host,
        port: serverData.port,
        username: serverData.user,
        name: serverData.label,
      });

      // Reload saved connections to update UI
      await loadSavedConnections();

      showSuccess(`Servidor ${serverData.label} adicionado com sucesso`);
    } catch (error) {
      console.error("Error adding server:", error);
      showError(`Erro ao adicionar servidor: ${error}`);
    }
  };

  const handleTestConnection = async (server: ServerInfo) => {
    setConnectingServerId(server.id);

    try {
      const result = await invoke<string>("ssh_test_connection", {
        host: server.host,
        port: server.port,
        username: server.user,
        password: server.password,
      });

      showSuccess(`✅ ${result}`);
    } catch (error) {
      showError(`❌ Teste falhou: ${error}`);
    } finally {
      setConnectingServerId(null);
    }
  };

  const handleConnectServer = async (server: ServerInfo) => {
    setConnectingServerId(server.id);

    try {
      const connectionId = await invoke<string>("ssh_connect", {
        host: server.host,
        port: server.port,
        username: server.user,
        password: server.password,
      });

      showSuccess(
        `Conectado ao servidor ${server.label} (ID: ${connectionId})`,
      );
      await loadSshConnections();
    } catch (error) {
      console.error("Error connecting to server:", error);
      showError(`Erro ao conectar: ${error}`);
    } finally {
      setConnectingServerId(null);
    }
  };

  const handleDisconnectServer = async (server: ServerInfo) => {
    if (!server.connectionId) {
      showError("Nenhuma conexão ativa encontrada");
      return;
    }

    setConnectingServerId(server.id);

    try {
      const result = await invoke<string>("ssh_disconnect", {
        connectionId: server.connectionId,
      });

      showSuccess(`Desconectado: ${result}`);
      await loadSshConnections();
    } catch (error) {
      console.error("Error disconnecting from server:", error);
      showError(`Erro ao desconectar: ${error}`);
    } finally {
      setConnectingServerId(null);
    }
  };

  const handleDisconnectAll = async () => {
    try {
      const result = await invoke<string>("ssh_disconnect_all");
      showSuccess(`${result}`);
      await loadSshConnections();
    } catch (error) {
      showError(`Erro ao desconectar todos: ${error}`);
    }
  };

  const handleRemoveServer = async (server: ServerInfo) => {
    if (server.isConnected) {
      showError("Desconecte do servidor antes de removê-lo");
      return;
    }

    if (
      !confirm(`Tem certeza que deseja remover o servidor "${server.label}"?`)
    ) {
      return;
    }

    try {
      // Remove from backend
      await invoke<string>("ssh_remove_saved_connection", {
        host: server.host,
        port: server.port,
        username: server.user,
      });

      // Reload saved connections to update UI
      await loadSavedConnections();

      showSuccess(`Servidor ${server.label} removido`);
    } catch (error) {
      console.error("Error removing server:", error);
      showError(`Erro ao remover servidor: ${error}`);
    }
  };

  const handleOpenCommandModal = (server: ServerInfo) => {
    if (!server.isConnected || !server.connectionId) {
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

      await loadSavedConnections();
      handleCloseEditModal();
      showSuccess("Nome da conexão atualizado com sucesso");
    } catch (error) {
      console.error("Error updating server name:", error);
      showError(`Erro ao atualizar nome: ${error}`);
    }
  };

  const handleExecuteCommand = async () => {
    if (!commandModal.server?.connectionId || !command.trim()) {
      showError("Conexão ou comando inválido");
      return;
    }

    setIsExecutingCommand(true);

    try {
      const output = await invoke<string>("ssh_execute_command", {
        connectionId: commandModal.server.connectionId,
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

  const handleCleanupConnections = async () => {
    try {
      const removedCount = await invoke<number>(
        "ssh_cleanup_inactive_connections",
        {
          maxIdleMinutes: 30,
        },
      );

      showSuccess(`${removedCount} conexões inativas removidas`);
      await loadSshConnections();
    } catch (error) {
      showError(`Erro na limpeza: ${error}`);
    }
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
            onClick={() => {
              loadSshConnections();
              loadSavedConnections();
            }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
            title="Atualizar conexões"
          >
            <FaSync className="w-4 h-4" />
            Atualizar
          </button>
          <button
            onClick={handleCleanupConnections}
            className="flex items-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors"
            title="Limpar conexões inativas"
          >
            <FaTrash className="w-4 h-4" />
            Limpeza
          </button>
          <button
            onClick={handleDisconnectAll}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
            title="Desconectar todos"
          >
            <FaStop className="w-4 h-4" />
            Desconectar Todos
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
            {savedConnections.length} servidor(es) salvo(s)
          </span>
          <span className="text-green-400">
            {sshConnections.length} conexão(ões) ativa(s)
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
                    <th className="px-4 py-4 text-sm font-medium text-gray-300 w-48">
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
                        <div className="flex items-center gap-1 flex-wrap">
                          {!server.isConnected ? (
                            <>
                              <ActionButton
                                onClick={() => {
                                  if (!server.password) {
                                    const password = prompt(
                                      `Digite a senha para ${server.user}@${server.host}:`,
                                    );
                                    if (password) {
                                      const serverWithPassword = {
                                        ...server,
                                        password,
                                      };
                                      handleTestConnection(serverWithPassword);
                                    }
                                  } else {
                                    handleTestConnection(server);
                                  }
                                }}
                                icon={FaEye}
                                className="hover:bg-blue-600"
                                disabled={connectingServerId === server.id}
                                title="Testar conexão"
                              >
                                {connectingServerId === server.id
                                  ? "Testando..."
                                  : "Testar"}
                              </ActionButton>
                              <ActionButton
                                onClick={() => {
                                  if (!server.password) {
                                    const password = prompt(
                                      `Digite a senha para ${server.user}@${server.host}:`,
                                    );
                                    if (password) {
                                      const serverWithPassword = {
                                        ...server,
                                        password,
                                      };
                                      handleConnectServer(serverWithPassword);
                                    }
                                  } else {
                                    handleConnectServer(server);
                                  }
                                }}
                                icon={FaPlay}
                                className="hover:bg-green-600"
                                disabled={connectingServerId === server.id}
                                title="Conectar ao servidor"
                              >
                                {connectingServerId === server.id
                                  ? "Conectando..."
                                  : "Conectar"}
                              </ActionButton>
                            </>
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

      {/* Command Execution Modal */}
      {commandModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Server Name Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
