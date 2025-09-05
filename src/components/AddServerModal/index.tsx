import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FaTimes, FaServer, FaSpinner } from "react-icons/fa";

interface ServerData {
  host: string;
  label: string;
  port: number;
  user: string;
  password?: string;
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
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [testPassword, setTestPassword] = useState("");
  const [savePassword, setSavePassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !serverData.host.trim() ||
      !serverData.label.trim() ||
      !serverData.user.trim() ||
      !testPassword.trim()
    ) {
      onShowError("Todos os campos são obrigatórios");
      return;
    }

    setIsConnecting(true);

    try {
      // Test SSH connection
      await invoke("ssh_test_connection", {
        host: serverData.host,
        port: serverData.port,
        username: serverData.user,
        password: testPassword,
      });

      onShowSuccess(`Conexão com ${serverData.label} estabelecida com sucesso`);

      // Include password if savePassword is checked
      const serverDataToSave = {
        ...serverData,
        password: savePassword ? testPassword : undefined,
      };

      onSuccess(serverDataToSave);
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
      });
      setTestPassword("");
      setSavePassword(false);
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
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                placeholder="Digite a senha do usuário"
                disabled={isConnecting}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="savePassword"
                checked={savePassword}
                onChange={(e) => setSavePassword(e.target.checked)}
                disabled={isConnecting}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label
                htmlFor="savePassword"
                className="ml-2 text-sm text-gray-300"
              >
                Salvar senha no servidor
              </label>
            </div>

            <div className="text-sm text-gray-400 space-y-1">
              <p>
                A conexão será testada antes de adicionar o servidor à lista.
              </p>
              {savePassword ? (
                <p className="text-yellow-400">
                  ⚠️ A senha será salva localmente e usada para conexões
                  automáticas.
                </p>
              ) : (
                <p className="text-blue-400">
                  ℹ️ A senha será solicitada a cada conexão.
                </p>
              )}
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
                !testPassword.trim()
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
