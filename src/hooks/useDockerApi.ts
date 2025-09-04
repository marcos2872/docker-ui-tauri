import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { useDockerConnection } from "../contexts/DockerConnectionContext";

// Tipos SSH adaptados para compatibilidade
export interface DockerSystemUsage {
  containers_running: number;
  containers_total: number;
  images_total: number;
  system_info: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string[];
  created: string;
}

export interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  created: string;
  size: string;
}

export interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
}

export interface DockerInfo {
  version: string;
  server_version: string;
  containers_total: number;
  containers_running: number;
  containers_paused: number;
  containers_stopped: number;
  images: number;
  architecture: string;
  os: string;
  kernel_version: string;
}

export interface CreateContainerRequest {
  name: string;
  image: string;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  environment: EnvVar[];
  command?: string;
  restart_policy: string;
  detach: boolean;
}

export interface PortMapping {
  host_port: number;
  container_port: number;
  protocol: string;
}

export interface VolumeMapping {
  host_path: string;
  container_path: string;
  read_only: boolean;
}

export interface EnvVar {
  key: string;
  value: string;
}

export function useDockerApi() {
  const { connectionType, currentSshConnection } = useDockerConnection();

  const invokeCommand = useCallback(
    async (command: string, args: any = {}) => {
      if (connectionType === "ssh" && currentSshConnection) {
        return await invoke(command, {
          connectionId: currentSshConnection.id,
          ...args,
        });
      } else {
        throw new Error("SSH connection required");
      }
    },
    [connectionType, currentSshConnection],
  );

  // Docker Status
  const getDockerStatus = useCallback(async () => {
    return await invokeCommand("ssh_docker_status");
  }, [invokeCommand]);

  // Docker Info
  const getDockerInfo = useCallback(async (): Promise<DockerInfo> => {
    return (await invokeCommand("ssh_docker_info")) as DockerInfo;
  }, [invokeCommand]);

  // System Usage
  const getDockerSystemUsage =
    useCallback(async (): Promise<DockerSystemUsage> => {
      return (await invokeCommand(
        "ssh_docker_system_usage",
      )) as DockerSystemUsage;
    }, [invokeCommand]);

  // Containers
  const listContainers = useCallback(async (): Promise<ContainerInfo[]> => {
    return (await invokeCommand(
      "ssh_docker_list_containers",
    )) as ContainerInfo[];
  }, [invokeCommand]);

  const startContainer = useCallback(
    async (containerId: string) => {
      return await invokeCommand("ssh_docker_start_container", {
        containerName: containerId,
      });
    },
    [invokeCommand],
  );

  const stopContainer = useCallback(
    async (containerId: string) => {
      return await invokeCommand("ssh_docker_stop_container", {
        containerName: containerId,
      });
    },
    [invokeCommand],
  );

  const pauseContainer = useCallback(
    async (containerId: string) => {
      return await invokeCommand("ssh_docker_pause_container", {
        containerName: containerId,
      });
    },
    [invokeCommand],
  );

  const unpauseContainer = useCallback(
    async (containerId: string) => {
      return await invokeCommand("ssh_docker_unpause_container", {
        containerName: containerId,
      });
    },
    [invokeCommand],
  );

  const removeContainer = useCallback(
    async (containerId: string) => {
      return await invokeCommand("ssh_docker_remove_container", {
        containerName: containerId,
      });
    },
    [invokeCommand],
  );

  const restartContainer = useCallback(
    async (containerId: string) => {
      return await invokeCommand("ssh_docker_restart_container", {
        containerName: containerId,
      });
    },
    [invokeCommand],
  );

  const createContainer = useCallback(
    async (request: CreateContainerRequest) => {
      return await invokeCommand("ssh_docker_create_container", { request });
    },
    [invokeCommand],
  );

  const getContainerLogs = useCallback(
    async (containerId: string) => {
      return await invokeCommand("ssh_docker_get_container_logs", {
        containerName: containerId,
      });
    },
    [invokeCommand],
  );

  const getContainerStats = useCallback(
    async (containerId: string) => {
      return await invokeCommand("ssh_docker_get_container_stats", {
        containerName: containerId,
      });
    },
    [invokeCommand],
  );

  // Images
  const listImages = useCallback(async (): Promise<ImageInfo[]> => {
    return (await invokeCommand("ssh_docker_list_images")) as ImageInfo[];
  }, [invokeCommand]);

  const removeImage = useCallback(
    async (imageId: string) => {
      return await invokeCommand("ssh_docker_remove_image", { imageId });
    },
    [invokeCommand],
  );

  const pullImage = useCallback(
    async (imageName: string) => {
      return await invokeCommand("ssh_docker_pull_image", { imageName });
    },
    [invokeCommand],
  );

  // Networks
  const listNetworks = useCallback(async (): Promise<NetworkInfo[]> => {
    return (await invokeCommand("ssh_docker_list_networks")) as NetworkInfo[];
  }, [invokeCommand]);

  const removeNetwork = useCallback(
    async (networkId: string) => {
      return await invokeCommand("ssh_docker_remove_network", { networkId });
    },
    [invokeCommand],
  );

  const createNetwork = useCallback(
    async (networkName: string) => {
      return await invokeCommand("ssh_docker_create_network", {
        networkName,
        driver: "bridge",
      });
    },
    [invokeCommand],
  );

  // Volumes
  const listVolumes = useCallback(async (): Promise<VolumeInfo[]> => {
    return (await invokeCommand("ssh_docker_list_volumes")) as VolumeInfo[];
  }, [invokeCommand]);

  const removeVolume = useCallback(
    async (volumeName: string) => {
      return await invokeCommand("ssh_docker_remove_volume", { volumeName });
    },
    [invokeCommand],
  );

  const createVolume = useCallback(
    async (volumeName: string) => {
      return await invokeCommand("ssh_docker_create_volume", {
        volumeName,
        driver: "local",
      });
    },
    [invokeCommand],
  );

  return {
    // Status and Info
    getDockerStatus,
    getDockerInfo,
    getDockerSystemUsage,

    // Containers
    listContainers,
    startContainer,
    stopContainer,
    pauseContainer,
    unpauseContainer,
    removeContainer,
    restartContainer,
    createContainer,
    getContainerLogs,
    getContainerStats,

    // Images
    listImages,
    removeImage,
    pullImage,

    // Networks
    listNetworks,
    removeNetwork,
    createNetwork,

    // Volumes
    listVolumes,
    removeVolume,
    createVolume,

    // Connection info
    connectionType,
    currentConnection: currentSshConnection,
    isConnected: connectionType === "ssh" && currentSshConnection !== null,
  };
}
