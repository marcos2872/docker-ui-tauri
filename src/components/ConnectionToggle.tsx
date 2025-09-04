import { useState } from "react";
import { useDockerConnection } from "../contexts/DockerConnectionContext";
import { ChevronDownIcon, ServerIcon } from "@heroicons/react/24/outline";

export function ConnectionToggle() {
  const {
    connectionType,
    currentSshConnection,
    availableSshConnections,
    isConnecting,
    connectionError,
    setConnectionType,
    connectToSsh,
    refreshSshConnections,
  } = useDockerConnection();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Removed handleLocalConnection since we only support SSH connections

  const handleSshConnection = async (connectionId: string) => {
    const success = await connectToSsh(connectionId);
    if (success) {
      setIsDropdownOpen(false);
    }
  };

  const getConnectionDisplayName = () => {
    if (currentSshConnection) {
      return `SSH: ${currentSshConnection.name}`;
    }
    return "No SSH Connection";
  };

  const getConnectionIcon = () => {
    return <ServerIcon className="w-4 h-4" />;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={isConnecting}
        className={`
          flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600
          border border-gray-600 rounded-md text-sm text-white
          transition-colors duration-200 min-w-[150px]
          ${isConnecting ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {getConnectionIcon()}
        <span className="flex-1 text-left">
          {isConnecting ? "Connecting..." : getConnectionDisplayName()}
        </span>
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform duration-200 ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isDropdownOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[250px] bg-gray-800 border border-gray-600 rounded-md shadow-lg z-50">
          {/* SSH Connections */}
          {availableSshConnections.length > 0 && (
            <>
              <div className="px-3 py-1 text-xs text-gray-500 bg-gray-750 border-t border-gray-600">
                SSH Connections
              </div>
              {availableSshConnections.map((connection) => (
                <button
                  key={connection.id}
                  onClick={() => handleSshConnection(connection.id)}
                  disabled={isConnecting}
                  className={`
                    w-full px-3 py-2 text-left hover:bg-gray-700
                    flex items-center gap-2 text-sm
                    ${
                      currentSshConnection?.id === connection.id
                        ? "bg-blue-600 text-white"
                        : "text-gray-300"
                    }
                    ${isConnecting ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  <ServerIcon className="w-4 h-4" />
                  <div>
                    <div className="font-medium">{connection.name}</div>
                    <div className="text-xs text-gray-400">
                      {connection.username}@{connection.host}:{connection.port}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* No SSH connections available */}
          {availableSshConnections.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <ServerIcon className="w-4 h-4" />
                No SSH connections configured
              </div>
              <button
                onClick={() => {
                  refreshSshConnections();
                  setIsDropdownOpen(false);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1"
              >
                Refresh connections
              </button>
            </div>
          )}
        </div>
      )}

      {/* Connection Error */}
      {connectionError && (
        <div className="absolute top-full left-0 mt-1 w-full bg-red-800 border border-red-600 rounded-md p-2 text-xs text-red-200 z-40">
          {connectionError}
        </div>
      )}

      {/* Click outside to close dropdown */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
}
