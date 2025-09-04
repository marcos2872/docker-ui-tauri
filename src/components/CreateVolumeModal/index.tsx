import { useState } from "react";
import { FaTimes, FaHdd } from "react-icons/fa";
import { useDockerApi } from "../../hooks/useDockerApi";

interface CreateVolumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowSuccess: (message: string) => void;
  onShowError: (message: string) => void;
}

export function CreateVolumeModal({
  isOpen,
  onClose,
  onSuccess,
  onShowSuccess,
  onShowError,
}: CreateVolumeModalProps) {
  const [volumeName, setVolumeName] = useState("");
  const [driver, setDriver] = useState("local");
  const [isCreating, setIsCreating] = useState(false);
  const { createVolume } = useDockerApi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!volumeName.trim()) {
      onShowError("Nome do volume é obrigatório");
      return;
    }

    setIsCreating(true);

    try {
      await createVolume(volumeName.trim());

      onShowSuccess(`Volume "${volumeName}" criado com sucesso`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error creating volume:", error);
      onShowError("Erro ao criar volume");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setVolumeName("");
      setDriver("local");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Criar Volume</h2>
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
                Nome do Volume *
              </label>
              <input
                type="text"
                value={volumeName}
                onChange={(e) => setVolumeName(e.target.value)}
                placeholder="Ex: mysql-data, app-logs, shared-files"
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
                  value="local"
                  style={{ backgroundColor: "#374151", color: "#ffffff" }}
                >
                  Local
                </option>
              </select>
            </div>

            <div className="text-sm text-gray-400">
              <p>O volume será criado e gerenciado pelo Docker.</p>
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
              disabled={isCreating || !volumeName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Criando...
                </>
              ) : (
                <>
                  <FaHdd className="w-4 h-4" />
                  Criar Volume
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
