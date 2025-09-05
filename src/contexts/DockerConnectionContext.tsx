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
  password: string | null;
}

interface DockerConnectionContextType {
  connectionType: ConnectionType;
  currentSshConnection: SshConnectionInfo | null;
  isConnecting: boolean;
  connectionError: string | null;
  availableSshConnections: SshConnectionInfo[];
  setConnectionType: (type: ConnectionType) => void;
  connectToSsh: (
    connection: SshConnectionInfo,
    password?: string,
  ) => Promise<boolean>;
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
    async (
      connection: SshConnectionInfo,
      password?: string,
    ): Promise<boolean> => {
      setIsConnecting(true);
      setConnectionError(null);

      try {
        const newSessionId = await invoke<string>("ssh_connect", {
          host: connection.host,
          port: connection.port,
          username: connection.username,
          password: password || "",
        });

        if (newSessionId) {
          const activeConnection = {
            ...connection,
            id: newSessionId, // Overwrite the saved ID with the active session ID
          };
          setCurrentSshConnection(activeConnection);
          setConnectionType("ssh");
          localStorage.setItem(
            "docker-current-ssh-connection",
            JSON.stringify(activeConnection),
          );
          return true;
        } else {
          throw new Error(
            "Failed to connect to SSH server. The backend returned an empty session ID.",
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setConnectionError(errorMessage);
        setCurrentSshConnection(null);
        localStorage.removeItem("docker-current-ssh-connection");
        return false;
      } finally {
        setIsConnecting(false);
      }
    },
    [setConnectionType],
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
