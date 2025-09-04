import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FaTimes, FaDownload } from "react-icons/fa";

interface PullImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowSuccess: (message: string) => void;
  onShowError: (message: string) => void;
}

export function PullImageModal({
  isOpen,
  onClose,
  onSuccess,
  onShowSuccess,
  onShowError,
}: PullImageModalProps) {
  const [imageName, setImageName] = useState("");
  const [tag, setTag] = useState("latest");
  const [isPulling, setIsPulling] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageName.trim()) {
      onShowError("Nome da imagem é obrigatório");
      return;
    }

    setIsPulling(true);

    try {
      const fullImageName = tag ? `${imageName}:${tag}` : imageName;
      await invoke("ssh_docker_pull_image", { imageName: fullImageName });

      onShowSuccess(`Imagem ${fullImageName} baixada com sucesso`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error pulling image:", error);
      onShowError("Erro ao fazer pull da imagem");
    } finally {
      setIsPulling(false);
    }
  };

  const handleClose = () => {
    if (!isPulling) {
      setImageName("");
      setTag("latest");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Pull de Imagem</h2>
          <button
            onClick={handleClose}
            disabled={isPulling}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome da Imagem *
              </label>
              <input
                type="text"
                value={imageName}
                onChange={(e) => setImageName(e.target.value)}
                placeholder="Ex: nginx, ubuntu, node"
                disabled={isPulling}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tag
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="latest"
                disabled={isPulling}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="text-sm text-gray-400">
              <p>
                A imagem será baixada do Docker Hub ou do registry configurado.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPulling}
              className="px-4 py-2 text-gray-300 bg-gray-600 rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPulling || !imageName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPulling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Fazendo Pull...
                </>
              ) : (
                <>
                  <FaDownload className="w-4 h-4" />
                  Pull da Imagem
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
