import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { invoke } from "@tauri-apps/api/core";

export type ConnectionType = "ssh" | "local";

export interface SshConnectionInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
}

interface DockerConnectionContextType {
  connectionType: ConnectionType;
  currentSshConnection: SshConnectionInfo | null;
  isConnecting: boolean;
  connectionError: string | null;
  availableSshConnections: SshConnectionInfo[];
  setConnectionType: (type: ConnectionType) => void;
  connectToSsh: (connectionId: string) => Promise<boolean>;
  disconnectFromSsh: () => Promise<void>;
  refreshSshConnections: () => Promise<void>;
  isDockerAvailable: () => Promise<boolean>;
}

const DockerConnectionContext = createContext<
  DockerConnectionContextType | undefined
>(undefined);

interface DockerConnectionProviderProps {
  children: React.ReactNode;
}

export function DockerConnectionProvider({
  children,
}: DockerConnectionProviderProps) {
  const [connectionType, setConnectionTypeState] =
    useState<ConnectionType>("ssh");
  const [currentSshConnection, setCurrentSshConnection] =
    useState<SshConnectionInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [availableSshConnections, setAvailableSshConnections] = useState<
    SshConnectionInfo[]
  >([]);

  // Load saved connection type from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("docker-connection-type");
    if (saved === "ssh") {
      setConnectionTypeState(saved);
    } else {
      setConnectionTypeState("ssh"); // Force SSH connection type
      localStorage.setItem("docker-connection-type", "ssh");
    }

    const savedSshConnection = localStorage.getItem(
      "docker-current-ssh-connection",
    );
    if (savedSshConnection) {
      try {
        setCurrentSshConnection(JSON.parse(savedSshConnection));
      } catch (error) {
        console.error("Error loading saved SSH connection:", error);
      }
    }

    // Load SSH connections on startup
    refreshSshConnections();
  }, []);

  const setConnectionType = useCallback((type: ConnectionType) => {
    setConnectionTypeState(type);
    localStorage.setItem("docker-connection-type", type);
    setConnectionError(null);
  }, []);

  const refreshSshConnections = useCallback(async () => {
    try {
      const connections = await invoke("ssh_get_saved_connections");
      setAvailableSshConnections(connections as SshConnectionInfo[]);
    } catch (error) {
      console.error("Error loading SSH connections:", error);
      setAvailableSshConnections([]);
    }
  }, []);

  const connectToSsh = useCallback(
    async (connectionId: string): Promise<boolean> => {
      setIsConnecting(true);
      setConnectionError(null);

      try {
        // Find the connection info
        const connectionInfo = availableSshConnections.find(
          (conn) => conn.id === connectionId,
        );

        if (!connectionInfo) {
          throw new Error("Connection not found");
        }

        // Test connection
        const isConnected = await invoke("ssh_connect", {
          connectionId: connectionId,
        });

        if (isConnected) {
          setCurrentSshConnection(connectionInfo);
          setConnectionType("ssh");
          localStorage.setItem(
            "docker-current-ssh-connection",
            JSON.stringify(connectionInfo),
          );
          return true;
        } else {
          throw new Error("Failed to connect to SSH server");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        setConnectionError(errorMessage);
        return false;
      } finally {
        setIsConnecting(false);
      }
    },
    [availableSshConnections, setConnectionType],
  );

  const disconnectFromSsh = useCallback(async () => {
    try {
      if (currentSshConnection) {
        await invoke("ssh_disconnect", {
          connectionId: currentSshConnection.id,
        });
      }
    } catch (error) {
      console.error("Error disconnecting from SSH:", error);
    } finally {
      setCurrentSshConnection(null);
      localStorage.removeItem("docker-current-ssh-connection");
    }
  }, [currentSshConnection]);

  const isDockerAvailable = useCallback(async (): Promise<boolean> => {
    try {
      if (connectionType === "ssh" && currentSshConnection) {
        const status = await invoke("ssh_docker_status", {
          connectionId: currentSshConnection.id,
        });
        return status === "Running";
      }
      return false;
    } catch (error) {
      console.error("Error checking Docker availability:", error);
      return false;
    }
  }, [connectionType, currentSshConnection]);

  // Auto-connect to saved SSH connection on startup (only once)
  useEffect(() => {
    let hasAutoConnected = false;

    const autoConnect = async () => {
      if (
        connectionType === "ssh" &&
        currentSshConnection &&
        availableSshConnections.length > 0 &&
        !hasAutoConnected
      ) {
        hasAutoConnected = true;
        const connectionExists = availableSshConnections.some(
          (conn) => conn.id === currentSshConnection.id,
        );

        if (connectionExists) {
          // Try to reconnect
          const connected = await connectToSsh(currentSshConnection.id);
          if (!connected) {
            // If connection failed, switch to local
            setConnectionType("local");
          }
        } else {
          // Connection no longer exists, switch to local
          setConnectionType("local");
        }
      }
    };

    if (availableSshConnections.length > 0) {
      autoConnect();
    }
  }, [availableSshConnections.length]); // Remove dependencies that cause loops

  const value: DockerConnectionContextType = {
    connectionType,
    currentSshConnection,
    isConnecting,
    connectionError,
    availableSshConnections,
    setConnectionType,
    connectToSsh,
    disconnectFromSsh,
    refreshSshConnections,
    isDockerAvailable,
  };

  return (
    <DockerConnectionContext.Provider value={value}>
      {children}
    </DockerConnectionContext.Provider>
  );
}

export function useDockerConnection() {
  const context = useContext(DockerConnectionContext);
  if (context === undefined) {
    throw new Error(
      "useDockerConnection must be used within a DockerConnectionProvider",
    );
  }
  return context;
}
