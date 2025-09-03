import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FaTimes, FaNetworkWired } from "react-icons/fa";

interface CreateNetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowSuccess: (message: string) => void;
  onShowError: (message: string) => void;
}

export function CreateNetworkModal({
  isOpen,
  onClose,
  onSuccess,
  onShowSuccess,
  onShowError,
}: CreateNetworkModalProps) {
  const [networkName, setNetworkName] = useState("");
  const [driver, setDriver] = useState("bridge");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!networkName.trim()) {
      onShowError("Nome da network é obrigatório");
      return;
    }

    setIsCreating(true);

    try {
      await invoke("docker_create_network", {
        networkName: networkName.trim(),
        driver,
      });

      onShowSuccess(`Network "${networkName}" criada com sucesso`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error creating network:", error);
      onShowError("Erro ao criar network");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setNetworkName("");
      setDriver("bridge");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Criar Network</h2>
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome da Network *
              </label>
              <input
                type="text"
                value={networkName}
                onChange={(e) => setNetworkName(e.target.value)}
                placeholder="Ex: app-network, backend-net, shared-net"
                disabled={isCreating}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Driver
              </label>
              <select
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
                disabled={isCreating}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50 appearance-none"
                style={{
                  backgroundColor: "#374151",
                  color: "#ffffff",
                }}
              >
                <option
                  value="bridge"
                  style={{ backgroundColor: "#374151", color: "#ffffff" }}
                >
                  Bridge
                </option>
                <option
                  value="overlay"
                  style={{ backgroundColor: "#374151", color: "#ffffff" }}
                >
                  Overlay
                </option>
                <option
                  value="host"
                  style={{ backgroundColor: "#374151", color: "#ffffff" }}
                >
                  Host
                </option>
                <option
                  value="none"
                  style={{ backgroundColor: "#374151", color: "#ffffff" }}
                >
                  None
                </option>
                <option
                  value="macvlan"
                  style={{ backgroundColor: "#374151", color: "#ffffff" }}
                >
                  Macvlan
                </option>
              </select>
            </div>

            <div className="text-sm text-gray-400">
              <p>A network será criada e gerenciada pelo Docker.</p>
              <p className="mt-1">
                <strong>Bridge:</strong> Padrão para containers no mesmo host
                <br />
                <strong>Overlay:</strong> Para containers em múltiplos hosts
                <br />
                <strong>Host:</strong> Remove isolamento de rede
                <br />
                <strong>None:</strong> Desabilita toda rede
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              className="px-4 py-2 text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isCreating || !networkName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Criando...
                </>
              ) : (
                <>
                  <FaNetworkWired className="w-4 h-4" />
                  Criar Network
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
