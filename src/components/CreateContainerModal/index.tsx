import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FaTimes, FaPlus, FaTrash } from "react-icons/fa";

interface PortMapping {
  host_port: number;
  container_port: number;
  protocol: string;
}

interface VolumeMapping {
  host_path: string;
  container_path: string;
  read_only: boolean;
}

interface EnvVar {
  key: string;
  value: string;
}

interface CreateContainerRequest {
  name: string;
  image: string;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  environment: EnvVar[];
  command?: string;
  restart_policy: string;
}

interface CreateContainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowSuccess?: (message: string) => void;
  onShowError?: (message: string) => void;
}

export function CreateContainerModal({
  isOpen,
  onClose,
  onSuccess,
  onShowSuccess,
  onShowError,
}: CreateContainerModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateContainerRequest>({
    name: "",
    image: "",
    ports: [],
    volumes: [],
    environment: [],
    command: "",
    restart_policy: "no",
  });

  const [newPort, setNewPort] = useState<PortMapping>({
    host_port: 8080,
    container_port: 80,
    protocol: "tcp",
  });

  const [newVolume, setNewVolume] = useState<VolumeMapping>({
    host_path: "",
    container_path: "",
    read_only: false,
  });

  const [newEnvVar, setNewEnvVar] = useState<EnvVar>({
    key: "",
    value: "",
  });

  // Exemplos pré-definidos
  const examples = [
    {
      name: "nginx-web",
      image: "nginx:latest",
      ports: [{ host_port: 8080, container_port: 80, protocol: "tcp" }],
      environment: [],
      volumes: [],
    },
    {
      name: "redis-cache",
      image: "redis:alpine",
      ports: [{ host_port: 6379, container_port: 6379, protocol: "tcp" }],
      environment: [],
      volumes: [],
    },
    {
      name: "postgres-db",
      image: "postgres:15",
      ports: [{ host_port: 5432, container_port: 5432, protocol: "tcp" }],
      environment: [
        { key: "POSTGRES_DB", value: "myapp" },
        { key: "POSTGRES_USER", value: "admin" },
        { key: "POSTGRES_PASSWORD", value: "password123" },
      ],
      volumes: [
        {
          host_path: "/var/lib/postgresql/data",
          container_path: "/var/lib/postgresql/data",
          read_only: false,
        },
      ],
    },
  ];

  const loadExample = (example: (typeof examples)[0]) => {
    setFormData({
      ...formData,
      name: example.name,
      image: example.image,
      ports: example.ports,
      environment: example.environment,
      volumes: example.volumes,
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      image: "",
      ports: [],
      volumes: [],
      environment: [],
      command: "",
      restart_policy: "no",
    });
    setNewPort({ host_port: 8080, container_port: 80, protocol: "tcp" });
    setNewVolume({ host_path: "", container_path: "", read_only: false });
    setNewEnvVar({ key: "", value: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.image) {
      return;
    }

    setLoading(true);
    try {
      await invoke("ssh_docker_create_container", {
        request: {
          ...formData,
          command: formData.command || null,
        },
      });
      onShowSuccess?.(`Container "${formData.name}" criado com sucesso!`);
      onSuccess();
      resetForm();
      onClose();
    } catch (error) {
      console.error("Error creating container:", error);
      onShowError?.(`Erro ao criar container: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const addPort = () => {
    if (newPort.host_port && newPort.container_port) {
      setFormData((prev) => ({
        ...prev,
        ports: [...prev.ports, newPort],
      }));
      setNewPort({ host_port: 8080, container_port: 80, protocol: "tcp" });
    }
  };

  const removePort = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      ports: prev.ports.filter((_, i) => i !== index),
    }));
  };

  const addVolume = () => {
    if (newVolume.host_path && newVolume.container_path) {
      setFormData((prev) => ({
        ...prev,
        volumes: [...prev.volumes, newVolume],
      }));
      setNewVolume({ host_path: "", container_path: "", read_only: false });
    }
  };

  const removeVolume = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      volumes: prev.volumes.filter((_, i) => i !== index),
    }));
  };

  const addEnvVar = () => {
    if (newEnvVar.key && newEnvVar.value) {
      setFormData((prev) => ({
        ...prev,
        environment: [...prev.environment, newEnvVar],
      }));
      setNewEnvVar({ key: "", value: "" });
    }
  };

  const removeEnvVar = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      environment: prev.environment.filter((_, i) => i !== index),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Criar Container</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Quick Examples */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Exemplos Rápidos
            </label>
            <div className="flex gap-2 flex-wrap">
              {examples.map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => loadExample(example)}
                  className="px-3 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition-colors"
                >
                  {example.name}
                </button>
              ))}
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome do Container *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Ex: nginx-web, redis-cache, postgres-db"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Imagem *
              </label>
              <input
                type="text"
                value={formData.image}
                onChange={(e) =>
                  setFormData({ ...formData, image: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Ex: nginx:latest, redis:alpine, postgres:15"
                required
              />
            </div>
          </div>

          {/* Command and Restart Policy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Comando (opcional)
              </label>
              <input
                type="text"
                value={formData.command}
                onChange={(e) =>
                  setFormData({ ...formData, command: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="Ex: /bin/bash, npm start, python app.py"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Política de Restart
              </label>
              <select
                value={formData.restart_policy}
                onChange={(e) =>
                  setFormData({ ...formData, restart_policy: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none appearance-none"
                style={{
                  backgroundColor: "#364153",
                  color: "#ffffff",
                }}
              >
                <option
                  value="no"
                  style={{ backgroundColor: "#364153", color: "#ffffff" }}
                >
                  Nunca reiniciar
                </option>
                <option
                  value="always"
                  style={{ backgroundColor: "#364153", color: "#ffffff" }}
                >
                  Sempre reiniciar
                </option>
                <option
                  value="unless-stopped"
                  style={{ backgroundColor: "#364153", color: "#ffffff" }}
                >
                  Reiniciar a menos que parado manualmente
                </option>
                <option
                  value="on-failure"
                  style={{ backgroundColor: "#364153", color: "#ffffff" }}
                >
                  Reiniciar apenas em caso de falha
                </option>
              </select>
            </div>
          </div>

          {/* Port Mappings */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Mapeamento de Portas
            </label>
            <div className="space-y-3">
              {formData.ports.map((port, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-gray-700 rounded-lg"
                >
                  <span className="text-white text-sm">
                    {port.host_port} → {port.container_port} ({port.protocol})
                  </span>
                  <button
                    type="button"
                    onClick={() => removePort(index)}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newPort.host_port}
                  onChange={(e) =>
                    setNewPort({
                      ...newPort,
                      host_port: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-20 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="8080"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="number"
                  value={newPort.container_port}
                  onChange={(e) =>
                    setNewPort({
                      ...newPort,
                      container_port: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-20 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="80"
                />
                <select
                  value={newPort.protocol}
                  onChange={(e) =>
                    setNewPort({ ...newPort, protocol: e.target.value })
                  }
                  className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none appearance-none"
                  style={{
                    backgroundColor: "#374151",
                    color: "#ffffff",
                  }}
                >
                  <option
                    value="tcp"
                    style={{ backgroundColor: "#374151", color: "#ffffff" }}
                  >
                    TCP
                  </option>
                  <option
                    value="udp"
                    style={{ backgroundColor: "#374151", color: "#ffffff" }}
                  >
                    UDP
                  </option>
                </select>
                <button
                  type="button"
                  onClick={addPort}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                >
                  <FaPlus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Volume Mappings */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Mapeamento de Volumes
            </label>
            <div className="space-y-3">
              {formData.volumes.map((volume, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-gray-700 rounded-lg"
                >
                  <span className="text-white text-sm flex-1">
                    {volume.host_path} → {volume.container_path}
                    {volume.read_only && " (somente leitura)"}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeVolume(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newVolume.host_path}
                  onChange={(e) =>
                    setNewVolume({ ...newVolume, host_path: e.target.value })
                  }
                  className="flex-1 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Ex: /home/user/data, ./logs"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="text"
                  value={newVolume.container_path}
                  onChange={(e) =>
                    setNewVolume({
                      ...newVolume,
                      container_path: e.target.value,
                    })
                  }
                  className="flex-1 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Ex: /var/lib/data, /app/logs"
                />
                <label className="flex items-center gap-1 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={newVolume.read_only}
                    onChange={(e) =>
                      setNewVolume({
                        ...newVolume,
                        read_only: e.target.checked,
                      })
                    }
                    className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                    style={{
                      backgroundColor: "#374151",
                      borderColor: "#4B5563",
                      accentColor: "#3B82F6",
                    }}
                  />
                  RO
                </label>
                <button
                  type="button"
                  onClick={addVolume}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                >
                  <FaPlus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Variáveis de Ambiente
            </label>
            <div className="space-y-3">
              {formData.environment.map((env, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-gray-700 rounded-lg"
                >
                  <span className="text-white text-sm flex-1">
                    {env.key} = {env.value}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEnvVar(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newEnvVar.key}
                  onChange={(e) =>
                    setNewEnvVar({ ...newEnvVar, key: e.target.value })
                  }
                  className="flex-1 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Ex: NODE_ENV, DATABASE_URL"
                />
                <span className="text-gray-400">=</span>
                <input
                  type="text"
                  value={newEnvVar.value}
                  onChange={(e) =>
                    setNewEnvVar({ ...newEnvVar, value: e.target.value })
                  }
                  className="flex-1 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Ex: production, localhost:5432"
                />
                <button
                  type="button"
                  onClick={addEnvVar}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                >
                  <FaPlus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-gray-700">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors"
            >
              Limpar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name || !formData.image}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Criando Container..." : "Criar Container"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
