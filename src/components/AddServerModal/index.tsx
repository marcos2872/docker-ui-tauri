import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FaTimes, FaServer, FaSpinner } from "react-icons/fa";

interface ServerData {
  host: string;
  label: string;
  port: number;
  user: string;
  password: string;
}

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (server: ServerData) => void;
  onShowSuccess: (message: string) => void;
  onShowError: (message: string) => void;
}

export function AddServerModal({
  isOpen,
  onClose,
  onSuccess,
  onShowSuccess,
  onShowError,
}: AddServerModalProps) {
  const [serverData, setServerData] = useState<ServerData>({
    host: "",
    label: "",
    port: 22,
    user: "",
    password: "",
  });
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !serverData.host.trim() ||
      !serverData.label.trim() ||
      !serverData.user.trim() ||
      !serverData.password.trim()
    ) {
      onShowError("Todos os campos são obrigatórios");
      return;
    }

    setIsConnecting(true);

    try {
      // Test SSH connection
      await invoke("test_ssh_connection", {
        host: serverData.host,
        port: serverData.port,
        user: serverData.user,
        password: serverData.password,
      });

      onShowSuccess(`Conexão com ${serverData.label} estabelecida com sucesso`);
      onSuccess(serverData);
      handleClose();
    } catch (error) {
      console.error("Error testing connection:", error);
      onShowError(`Erro ao conectar: ${error}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    if (!isConnecting) {
      setServerData({
        host: "",
        label: "",
        port: 22,
        user: "",
        password: "",
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Adicionar Servidor</h2>
          <button
            onClick={handleClose}
            disabled={isConnecting}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Label *
              </label>
              <input
                type="text"
                value={serverData.label}
                onChange={(e) =>
                  setServerData({ ...serverData, label: e.target.value })
                }
                placeholder="Ex: Production Server, Development Box"
                disabled={isConnecting}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Host *
              </label>
              <input
                type="text"
                value={serverData.host}
                onChange={(e) =>
                  setServerData({ ...serverData, host: e.target.value })
                }
                placeholder="Ex: 192.168.1.100, server.example.com"
                disabled={isConnecting}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Porta
              </label>
              <input
                type="number"
                value={serverData.port}
                onChange={(e) =>
                  setServerData({
                    ...serverData,
                    port: parseInt(e.target.value) || 22,
                  })
                }
                min="1"
                max="65535"
                disabled={isConnecting}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Usuário *
              </label>
              <input
                type="text"
                value={serverData.user}
                onChange={(e) =>
                  setServerData({ ...serverData, user: e.target.value })
                }
                placeholder="Ex: root, ubuntu, admin"
                disabled={isConnecting}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Senha *
              </label>
              <input
                type="password"
                value={serverData.password}
                onChange={(e) =>
                  setServerData({ ...serverData, password: e.target.value })
                }
                placeholder="Digite a senha do usuário"
                disabled={isConnecting}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="text-sm text-gray-400">
              <p>
                A conexão será testada antes de adicionar o servidor à lista.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={isConnecting}
              className="px-4 py-2 text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                isConnecting ||
                !serverData.host.trim() ||
                !serverData.label.trim() ||
                !serverData.user.trim() ||
                !serverData.password.trim()
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <>
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  Testando Conexão...
                </>
              ) : (
                <>
                  <FaServer className="w-4 h-4" />
                  Adicionar Servidor
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
