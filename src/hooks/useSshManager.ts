import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";

export interface SshConnectionInfo {
  host: string;
  port: number;
  username: string;
  connection_id: string;
  connected_at: number;
  last_activity: number;
}

export interface SshConnectionRequest {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface UseSshManagerReturn {
  connections: SshConnectionInfo[];
  isLoading: boolean;
  error: string | null;
  testConnection: (request: SshConnectionRequest) => Promise<string>;
  connect: (request: SshConnectionRequest) => Promise<string>;
  disconnect: (connectionId: string) => Promise<string>;
  disconnectAll: () => Promise<string>;
  executeCommand: (connectionId: string, command: string) => Promise<string>;
  isConnected: (connectionId: string) => Promise<boolean>;
  getConnectionInfo: (connectionId: string) => Promise<SshConnectionInfo>;
  cleanupInactiveConnections: (maxIdleMinutes?: number) => Promise<number>;
  loadConnections: () => Promise<void>;
  clearError: () => void;
}

export const useSshManager = (): UseSshManagerReturn => {
  const [connections, setConnections] = useState<SshConnectionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    setError(errorMessage);
    console.error("SSH Manager Error:", errorMessage);
    throw new Error(errorMessage);
  }, []);

  const loadConnections = useCallback(async () => {
    try {
      setIsLoading(true);
      clearError();
      const activeConnections = await invoke<SshConnectionInfo[]>(
        "ssh_list_connections",
      );
      setConnections(activeConnections);
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  }, [handleError, clearError]);

  const testConnection = useCallback(
    async (request: SshConnectionRequest): Promise<string> => {
      try {
        setIsLoading(true);
        clearError();
        const result = await invoke<string>("ssh_test_connection", {
          host: request.host,
          port: request.port,
          username: request.username,
          password: request.password,
        });
        return result;
      } catch (error) {
        handleError(error);
        return "";
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, clearError],
  );

  const connect = useCallback(
    async (request: SshConnectionRequest): Promise<string> => {
      try {
        setIsLoading(true);
        clearError();
        const connectionId = await invoke<string>("ssh_connect", {
          host: request.host,
          port: request.port,
          username: request.username,
          password: request.password,
        });
        await loadConnections();
        return connectionId;
      } catch (error) {
        handleError(error);
        return "";
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, clearError, loadConnections],
  );

  const disconnect = useCallback(
    async (connectionId: string): Promise<string> => {
      try {
        setIsLoading(true);
        clearError();
        const result = await invoke<string>("ssh_disconnect", { connectionId });
        await loadConnections();
        return result;
      } catch (error) {
        handleError(error);
        return "";
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, clearError, loadConnections],
  );

  const disconnectAll = useCallback(async (): Promise<string> => {
    try {
      setIsLoading(true);
      clearError();
      const result = await invoke<string>("ssh_disconnect_all");
      await loadConnections();
      return result;
    } catch (error) {
      handleError(error);
      return "";
    } finally {
      setIsLoading(false);
    }
  }, [handleError, clearError, loadConnections]);

  const executeCommand = useCallback(
    async (connectionId: string, command: string): Promise<string> => {
      try {
        setIsLoading(true);
        clearError();
        const output = await invoke<string>("ssh_execute_command", {
          connectionId,
          command,
        });
        return output;
      } catch (error) {
        handleError(error);
        return "";
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, clearError],
  );

  const isConnected = useCallback(
    async (connectionId: string): Promise<boolean> => {
      try {
        clearError();
        const connected = await invoke<boolean>("ssh_is_connected", {
          connectionId,
        });
        return connected;
      } catch (error) {
        handleError(error);
        return false;
      }
    },
    [handleError, clearError],
  );

  const getConnectionInfo = useCallback(
    async (connectionId: string): Promise<SshConnectionInfo> => {
      try {
        clearError();
        const info = await invoke<SshConnectionInfo>(
          "ssh_get_connection_info",
          { connectionId },
        );
        return info;
      } catch (error) {
        handleError(error);
        throw error;
      }
    },
    [handleError, clearError],
  );

  const cleanupInactiveConnections = useCallback(
    async (maxIdleMinutes: number = 30): Promise<number> => {
      try {
        setIsLoading(true);
        clearError();
        const removedCount = await invoke<number>(
          "ssh_cleanup_inactive_connections",
          {
            maxIdleMinutes,
          },
        );
        await loadConnections();
        return removedCount;
      } catch (error) {
        handleError(error);
        return 0;
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, clearError, loadConnections],
  );

  return {
    connections,
    isLoading,
    error,
    testConnection,
    connect,
    disconnect,
    disconnectAll,
    executeCommand,
    isConnected,
    getConnectionInfo,
    cleanupInactiveConnections,
    loadConnections,
    clearError,
  };
};
