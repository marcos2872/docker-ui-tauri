// Imports para gerenciamento do Docker
use anyhow::{Context, Result};
use bollard::{
    models::ContainerCreateBody,
    models::{ContainerStatsResponse, ImageSummary},
    query_parameters::CreateContainerOptions,
    query_parameters::{
        ListContainersOptions, ListImagesOptions, ListNetworksOptions, ListVolumesOptions,
        RestartContainerOptions, StatsOptions,
    },
    Docker,
};
use chrono;
use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fmt,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

// Informações básicas de um container
#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    pub ports: Vec<i32>,
    pub created: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageInfo {
    pub id: String,
    pub repository: String,
    pub tag: String,
    pub created: i64,
    pub size: i64,
    pub containers: i64,
    pub in_use: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub scope: String,
    pub created: String,
    pub containers_count: i32,
    pub is_system: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VolumeInfo {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
    pub created: String,
    pub containers_count: i32,
}

// Status possíveis do Docker
#[derive(Debug, Serialize, Deserialize)]
pub enum DockerStatus {
    Running,
    NotRunning,
    NotInstalled,
    PermissionDenied,
}

impl fmt::Display for DockerStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DockerStatus::Running => write!(f, "Rodando"),
            DockerStatus::NotRunning => write!(f, "Não está rodando"),
            DockerStatus::NotInstalled => write!(f, "Não instalado"),
            DockerStatus::PermissionDenied => write!(f, "Permissão negada"),
        }
    }
}

// Cache para estatísticas anteriores (necessário para cálculo de delta)
#[derive(Debug, Clone)]
#[allow(dead_code)] // Alguns campos podem ser usados no futuro
struct PreviousStats {
    timestamp: u64,
    cpu_total: u64,
    system_total: u64,
    network_rx: u64,
    network_tx: u64,
    block_read: u64,
    block_write: u64,
}

// Tempo mínimo entre cálculos de CPU (em segundos)
const MIN_CPU_INTERVAL: u64 = 1;

// Gerenciador principal do Docker
pub struct DockerManager {
    pub docker: Docker,
    previous_stats: HashMap<String, PreviousStats>,
}

// Informações gerais do sistema Docker
#[derive(Debug, Serialize, Deserialize)]
pub struct DockerInfo {
    pub version: String,
    pub containers: i64,
    pub containers_paused: i64,
    pub containers_running: i64,
    pub containers_stopped: i64,
    pub images: i64,
    pub architecture: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CpuCalculate {
    pub usage_cpu: f64,
    pub online_cpus: u64,
}

// Uso total do sistema Docker
#[derive(Debug, Serialize, Deserialize)]
pub struct DockerSystemUsage {
    pub cpu_online: u64,
    pub cpu_usage: f64,
    pub memory_usage: u64,
    pub memory_limit: u64,
    pub network_rx_bytes: u64,
    pub network_tx_bytes: u64,
    pub block_read_bytes: u64,
    pub block_write_bytes: u64,
}

// Estatísticas detalhadas de um container
#[derive(Debug, Serialize, Deserialize)]
pub struct ContainerStats {
    pub id: String,
    pub name: String,
    pub cpu_percentage: f64,
    pub memory_usage: u64,
    pub memory_limit: u64,
    pub memory_percentage: f64,
    pub network_rx: u64,
    pub network_tx: u64,
    pub block_read: u64,
    pub block_write: u64,
}

// Estrutura para criar um novo container
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateContainerRequest {
    pub name: String,
    pub image: String,
    pub ports: Vec<PortMapping>,
    pub volumes: Vec<VolumeMapping>,
    pub environment: Vec<EnvVar>,
    pub command: Option<String>,
    pub restart_policy: String,
}

// Mapeamento de portas
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortMapping {
    pub host_port: u16,
    pub container_port: u16,
    pub protocol: String, // tcp ou udp
}

// Mapeamento de volumes
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VolumeMapping {
    pub host_path: String,
    pub container_path: String,
    pub read_only: bool,
}

// Variável de ambiente
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvVar {
    pub key: String,
    pub value: String,
}

impl DockerManager {
    // Cria nova instância conectando ao Docker daemon
    pub async fn new() -> Result<Self> {
        let docker = Docker::connect_with_socket_defaults()
            .context("Falha ao conectar com Docker daemon")?;

        Ok(DockerManager {
            docker,
            previous_stats: HashMap::new(),
        })
    }

    // Verifica status do Docker via linha de comando
    pub fn check_docker_status(&self) -> DockerStatus {
        let docker_version = Command::new("docker").arg("--version").output();

        match docker_version {
            Ok(output) => {
                if !output.status.success() {
                    return DockerStatus::NotInstalled;
                }
            }
            Err(_) => {
                return DockerStatus::NotInstalled;
            }
        }

        let docker_info = Command::new("docker").arg("info").output();

        match docker_info {
            Ok(output) => {
                if output.status.success() {
                    DockerStatus::Running
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let stdout = String::from_utf8_lossy(&output.stdout);

                    if stderr.contains("permission denied")
                        || stderr.contains("Permission denied")
                        || stderr.contains("dial unix")
                        || stderr.contains("connect: permission denied")
                        || stderr.contains("Got permission denied while trying to connect")
                        || stdout.contains("permission denied")
                    {
                        DockerStatus::PermissionDenied
                    } else if stderr.contains("Cannot connect to the Docker daemon")
                        || stderr.contains("Is the docker daemon running?")
                        || stderr.contains("docker daemon is not running")
                    {
                        DockerStatus::NotRunning
                    } else {
                        DockerStatus::PermissionDenied
                    }
                }
            }
            Err(_) => DockerStatus::PermissionDenied,
        }
    }

    // Obtém informações gerais do Docker
    pub async fn get_docker_info(&self) -> Result<DockerInfo> {
        let version = self
            .docker
            .version()
            .await
            .context("Falha ao obter versão do Docker")?;

        let info = self
            .docker
            .info()
            .await
            .context("Falha ao obter informações do Docker")?;

        Ok(DockerInfo {
            version: version.version.unwrap_or_default(),
            containers: info.containers.unwrap_or(0),
            containers_paused: info.containers_paused.unwrap_or(0),
            containers_running: info.containers_running.unwrap_or(0),
            containers_stopped: info.containers_stopped.unwrap_or(0),
            images: info.images.unwrap_or(0),
            architecture: version.arch.unwrap_or_default(),
        })
    }

    // Lista todos os containers (ativos e parados)
    pub async fn list_containers(&self) -> Result<Vec<ContainerInfo>> {
        let containers = self
            .docker
            .list_containers(Some(ListContainersOptions {
                all: true,
                ..Default::default()
            }))
            .await
            .context("Falha ao listar containers")?;

        let container_infos: Vec<ContainerInfo> = containers
            .into_iter()
            .map(|container| ContainerInfo {
                id: container.id.unwrap_or_default(),
                name: container
                    .names
                    .unwrap_or_default()
                    .join(", ")
                    .trim_start_matches('/')
                    .to_string(),
                image: container.image.unwrap_or_default(),
                state: container
                    .state
                    .map_or("unknown".to_string(), |s| s.to_string()),
                status: container.status.unwrap_or_default(),
                ports: container
                    .ports
                    .unwrap_or_default()
                    .iter()
                    .filter_map(|port| port.public_port.map(|p| p as i32))
                    .collect(),
                created: container.created.unwrap_or_default(),
            })
            .collect();

        Ok(container_infos)
    }

    // Inicia um container
    pub async fn start_container(&self, container_name: &str) -> Result<()> {
        let output = Command::new("docker")
            .args(&["start", container_name])
            .output()
            .context("Failed to execute docker start command")?;

        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "Failed to start container {}: {}",
                container_name,
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    // Lista todas as imagens
    pub async fn list_images(&self) -> Result<Vec<ImageInfo>> {
        let images = self
            .docker
            .list_images(Some(ListImagesOptions {
                all: false,
                ..Default::default()
            }))
            .await
            .context("Falha ao listar imagens")?;

        let mut image_infos: Vec<ImageInfo> = images
            .into_iter()
            .map(|image: ImageSummary| {
                let in_use = image.containers > 0;
                let (repository, tag) = if let Some(first_tag) = image.repo_tags.first() {
                    if let Some(colon_pos) = first_tag.rfind(':') {
                        let repo = first_tag[..colon_pos].to_string();
                        let tag = first_tag[colon_pos + 1..].to_string();
                        (repo, tag)
                    } else {
                        (first_tag.clone(), "latest".to_string())
                    }
                } else {
                    ("<none>".to_string(), "<none>".to_string())
                };

                ImageInfo {
                    id: image.id.clone(),
                    repository,
                    tag,
                    created: image.created,
                    size: image.size,
                    containers: image.containers,
                    in_use,
                }
            })
            .collect();

        // Ordena por nome do repositório para manter ordem consistente
        image_infos.sort_by(|a, b| a.repository.cmp(&b.repository));

        Ok(image_infos)
    }

    // deleta uma imagem
    pub async fn remove_image(&self, image_id: &str) -> Result<()> {
        let output = Command::new("docker")
            .args(&["rmi", image_id])
            .output()
            .context("Failed to execute docker rmi command")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
            if stderr.contains("conflict")
                && stderr.contains("image is being used by running container")
            {
                return Err(anyhow::anyhow!(
                    "IN_USE:A imagem está em uso por um contêiner."
                ));
            } else {
                return Err(anyhow::anyhow!(
                    "OTHER_ERROR:Não foi possível remover a imagem. Tente forçar a remoção."
                ));
            }
        }

        Ok(())
    }

    // Lista todas as networks
    pub async fn list_networks(&self) -> Result<Vec<NetworkInfo>> {
        let networks = self
            .docker
            .list_networks(Some(ListNetworksOptions {
                ..Default::default()
            }))
            .await
            .context("Falha ao listar networks")?;

        let containers = self
            .docker
            .list_containers(Some(ListContainersOptions {
                all: true,
                ..Default::default()
            }))
            .await
            .context("Falha ao listar containers")?;

        let network_ids: Vec<String> = containers
            .into_iter()
            .flat_map(|container| {
                container
                    .network_settings
                    .and_then(|settings| settings.networks)
                    .unwrap_or_default()
                    .into_values()
                    .filter_map(|endpoint| endpoint.network_id)
            })
            .collect();

        let mut network_infos: Vec<NetworkInfo> = networks
            .into_iter()
            .filter_map(|network| {
                let network_name = network.name.as_deref().unwrap_or("");
                let id = network.id.unwrap_or_default();

                // Filtra networks de sistema (bridge, host, none)
                let is_system = matches!(network_name, "bridge" | "host" | "none");

                if is_system {
                    return None; // Pula networks de sistema
                }

                let mut containers_count = 0;

                for network_id in &network_ids {
                    if network_id == &id {
                        containers_count += 1;
                    }
                }

                Some(NetworkInfo {
                    id,
                    name: network_name.to_string(),
                    driver: network.driver.unwrap_or_default(),
                    scope: network.scope.unwrap_or_default(),
                    created: network.created.unwrap_or_default(),
                    containers_count,
                    is_system: false, // Todas as networks listadas são de usuário
                })
            })
            .collect();

        // Ordena por nome para manter ordem consistente
        network_infos.sort_by(|a, b| a.name.cmp(&b.name));

        Ok(network_infos)
    }

    // Remove uma network
    pub async fn remove_network(&self, network_id: &str) -> Result<()> {
        let output = Command::new("docker")
            .args(&["network", "rm", network_id])
            .output()
            .context("Failed to execute docker network rm command")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
            if stderr.contains("has active endpoints") || stderr.contains("endpoint") {
                return Err(anyhow::anyhow!(
                    "IN_USE:A network possui containers conectados."
                ));
            } else if stderr.contains("not found") || stderr.contains("no such network") {
                return Err(anyhow::anyhow!("OTHER_ERROR:Network não encontrada."));
            } else {
                return Err(anyhow::anyhow!(
                    "OTHER_ERROR:Não foi possível remover a network: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
        }

        Ok(())
    }

    // Lista todos os volumes de containers
    pub async fn list_volumes(&self) -> Result<Vec<VolumeInfo>> {
        let volumes = self
            .docker
            .list_volumes(Some(ListVolumesOptions {
                ..Default::default()
            }))
            .await
            .context("Falha ao listar volumes")?;

        let containers = self
            .docker
            .list_containers(Some(ListContainersOptions {
                all: true,
                ..Default::default()
            }))
            .await
            .context("Falha ao listar containers")?;

        // Coleta nomes de volumes usados pelos containers
        let mut used_volumes: HashMap<String, i32> = HashMap::new();
        for container in containers {
            if let Some(mounts) = container.mounts {
                for mount in mounts {
                    if let Some(name) = mount.name {
                        if let Some(mount_type) = mount.typ.as_ref() {
                            if format!("{:?}", mount_type)
                                .to_lowercase()
                                .contains("volume")
                            {
                                *used_volumes.entry(name).or_insert(0) += 1;
                            }
                        }
                    }
                }
            }
        }

        let mut volume_infos: Vec<VolumeInfo> = volumes
            .volumes
            .unwrap_or_default()
            .into_iter()
            .map(|volume| {
                let volume_name = volume.name.clone();
                // Agora inclui TODOS os volumes, mas com contador de containers
                let containers_count = used_volumes.get(&volume_name).cloned().unwrap_or(0);

                VolumeInfo {
                    name: volume_name,
                    driver: volume.driver,
                    mountpoint: volume.mountpoint,
                    created: volume.created_at.unwrap_or_default(),
                    containers_count,
                }
            })
            .collect();

        // Ordena por nome para manter ordem consistente
        volume_infos.sort_by(|a, b| a.name.cmp(&b.name));

        Ok(volume_infos)
    }

    // Remove um volume
    pub async fn remove_volume(&self, volume_name: &str) -> Result<()> {
        let output = Command::new("docker")
            .args(&["volume", "rm", volume_name])
            .output()
            .context("Failed to execute docker volume rm command")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
            if stderr.contains("volume is in use") || stderr.contains("in use") {
                return Err(anyhow::anyhow!(
                    "IN_USE:O volume está sendo usado por containers."
                ));
            } else if stderr.contains("not found") || stderr.contains("no such volume") {
                return Err(anyhow::anyhow!("OTHER_ERROR:Volume não encontrado."));
            } else {
                return Err(anyhow::anyhow!(
                    "OTHER_ERROR:Não foi possível remover o volume: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
        }

        Ok(())
    }

    // Para um container
    pub async fn stop_container(&self, container_name: &str) -> Result<()> {
        let output = Command::new("docker")
            .args(&["stop", container_name])
            .output()
            .context("Failed to execute docker stop command")?;

        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "Failed to stop container {}: {}",
                container_name,
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    // Pausa um container
    pub async fn pause_container(&self, container_name: &str) -> Result<()> {
        let output = Command::new("docker")
            .args(&["pause", container_name])
            .output()
            .context("Failed to execute docker pause command")?;

        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "Failed to pause container {}: {}",
                container_name,
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    // Despausa um container
    pub async fn unpause_container(&self, container_name: &str) -> Result<()> {
        let output = Command::new("docker")
            .args(&["unpause", container_name])
            .output()
            .context("Failed to execute docker unpause command")?;

        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "Failed to unpause container {}: {}",
                container_name,
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    // deleta um container
    pub async fn remove_container(&self, container_name: &str) -> Result<()> {
        let output = Command::new("docker")
            .args(&["rm", container_name])
            .output()
            .context("Failed to execute docker unpause command")?;

        if !output.status.success() {
            return Err(anyhow::anyhow!(
                "Failed to unpause container {}: {}",
                container_name,
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        Ok(())
    }

    // Lista apenas containers em execução
    pub async fn list_running_containers(&self) -> Result<Vec<ContainerInfo>> {
        let containers = self
            .docker
            .list_containers(Some(ListContainersOptions {
                all: false, // Apenas containers rodando
                ..Default::default()
            }))
            .await
            .context("Falha ao listar containers ativos")?;

        let container_infos: Vec<ContainerInfo> = containers
            .into_iter()
            .map(|container| ContainerInfo {
                id: container.id.unwrap_or_default(),
                name: container
                    .names
                    .unwrap_or_default()
                    .join(", ")
                    .trim_start_matches('/')
                    .to_string(),
                image: container.image.unwrap_or_default(),
                state: container
                    .state
                    .map_or("unknown".to_string(), |s| s.to_string()),
                status: container.status.unwrap_or_default(),
                ports: container
                    .ports
                    .unwrap_or_default()
                    .iter()
                    .filter_map(|port| port.public_port.map(|p| p as i32))
                    .collect(),
                created: container.created.unwrap_or_default(),
            })
            .collect();

        Ok(container_infos)
    }

    // Coleta uso total do sistema Docker
    pub async fn get_docker_system_usage(&mut self) -> Result<DockerSystemUsage> {
        let containers = self.list_running_containers().await?;
        // let mut containers_stats = Vec::new();

        // Totalizadores de recursos
        let mut total_cpu = 0.0;
        let mut online_cpu = 0;
        let mut total_memory_usage = 0u64;
        let total_memory_limit = self.get_system_memory_limit().await?;
        let mut total_network_rx = 0u64;
        let mut total_network_tx = 0u64;
        let mut total_block_read = 0u64;
        let mut total_block_write = 0u64;

        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Itera por todos os containers coletando estatísticas
        for container in containers {
            if let Ok(Some(stats)) = self
                .docker
                .stats(
                    &container.id,
                    Some(StatsOptions {
                        stream: false,
                        one_shot: true,
                    }),
                )
                .try_next()
                .await
            {
                let cpu =
                    self.calculate_cpu_percentage_with_cache(&container.id, &stats, current_time);
                let cpu_percentage = cpu.usage_cpu;
                let cpus_online = cpu.online_cpus;
                let memory_usage = stats
                    .memory_stats
                    .as_ref()
                    .and_then(|m| m.usage)
                    .unwrap_or(0);
                // let memory_limit = stats
                //     .memory_stats
                //     .as_ref()
                //     .and_then(|m| m.limit)
                //     .unwrap_or(0);

                // let memory_percentage = if memory_limit > 0 {
                //     (memory_usage as f64 / memory_limit as f64) * 100.0
                // } else {
                //     0.0
                // };

                let (network_rx, network_tx) = self.get_network_stats(&stats);
                let (block_read, block_write) = self.get_block_stats(&stats);

                // containers_stats.push(ContainerStats {
                //     id: container.id.clone(),
                //     name: container.name.clone(),
                //     cpu_percentage,
                //     memory_usage,
                //     memory_limit,
                //     memory_percentage,
                //     network_rx,
                //     network_tx,
                //     block_read,
                //     block_write,
                // });

                online_cpu = cpus_online;
                total_cpu += cpu_percentage;
                total_memory_usage += memory_usage;
                total_network_rx += network_rx;
                total_network_tx += network_tx;
                total_block_read += block_read;
                total_block_write += block_write;
            }
        }

        // let memory_percentage = if total_memory_limit > 0 {
        //     (total_memory_usage as f64 / total_memory_limit as f64) * 100.0
        // } else {
        //     0.0
        // };

        Ok(DockerSystemUsage {
            cpu_online: online_cpu,
            cpu_usage: total_cpu,
            memory_usage: total_memory_usage,
            memory_limit: total_memory_limit,
            // memory_percentage,
            network_rx_bytes: total_network_rx,
            network_tx_bytes: total_network_tx,
            block_read_bytes: total_block_read,
            block_write_bytes: total_block_write,
            // containers_stats,
        })
    }

    // Calcula CPU com cache de estatísticas anteriores - SIMPLIFICADO
    fn calculate_cpu_percentage_with_cache(
        &mut self,
        container_id: &str,
        stats: &ContainerStatsResponse,
        current_time: u64,
    ) -> CpuCalculate {
        if let (Some(cpu_stats), Some(precpu_stats)) = (&stats.cpu_stats, &stats.precpu_stats) {
            if let (Some(cpu_usage), Some(precpu_usage)) = (
                cpu_stats.cpu_usage.as_ref(),
                precpu_stats.cpu_usage.as_ref(),
            ) {
                let cpu_total = cpu_usage.total_usage.unwrap_or(0);
                let system_total = cpu_stats.system_cpu_usage.unwrap_or(0);

                // Verifica se temos cache anterior e se tempo suficiente passou
                let (cpu_delta, system_delta) =
                    if let Some(prev_stats) = self.previous_stats.get(container_id) {
                        let time_elapsed = current_time.saturating_sub(prev_stats.timestamp);

                        if time_elapsed >= MIN_CPU_INTERVAL {
                            // Usa cache anterior se tempo suficiente passou
                            let cache_cpu_delta = cpu_total.saturating_sub(prev_stats.cpu_total);
                            let cache_system_delta =
                                system_total.saturating_sub(prev_stats.system_total);
                            (cache_cpu_delta, cache_system_delta)
                        } else {
                            // Fallback para precpu_stats se muito pouco tempo passou
                            let cpu_total_prev = precpu_usage.total_usage.unwrap_or(0);
                            let system_total_prev = precpu_stats.system_cpu_usage.unwrap_or(0);
                            (
                                cpu_total.saturating_sub(cpu_total_prev),
                                system_total.saturating_sub(system_total_prev),
                            )
                        }
                    } else {
                        // Primeira vez - usa precpu_stats
                        let cpu_total_prev = precpu_usage.total_usage.unwrap_or(0);
                        let system_total_prev = precpu_stats.system_cpu_usage.unwrap_or(0);
                        (
                            cpu_total.saturating_sub(cpu_total_prev),
                            system_total.saturating_sub(system_total_prev),
                        )
                    };

                // Atualiza cache para próxima iteração
                let (network_rx, network_tx) = self.get_network_stats(stats);
                let (block_read, block_write) = self.get_block_stats(stats);

                // Número de CPUs online
                let number_cpus = if let Some(online_cpus) = cpu_stats.online_cpus {
                    online_cpus as f64
                } else if let Some(percpu_usage) = &cpu_usage.percpu_usage {
                    percpu_usage.len().max(1) as f64
                } else {
                    1.0
                };

                // Sempre atualiza o cache
                self.previous_stats.insert(
                    container_id.to_string(),
                    PreviousStats {
                        timestamp: current_time,
                        cpu_total,
                        system_total,
                        network_rx,
                        network_tx,
                        block_read,
                        block_write,
                    },
                );

                // Evita divisão por zero
                if system_delta == 0 {
                    return CpuCalculate {
                        online_cpus: number_cpus as u64,
                        usage_cpu: 0.0,
                    };
                }

                // Fórmula correta do Docker CLI: (cpu_delta / system_delta) * number_cpus * 100
                let cpu_percent = (cpu_delta as f64 / system_delta as f64) * number_cpus * 100.0;

                CpuCalculate {
                    online_cpus: number_cpus as u64,
                    usage_cpu: cpu_percent.max(0.0),
                }
            } else {
                CpuCalculate {
                    online_cpus: 0,
                    usage_cpu: 0.0,
                }
            }
        } else {
            CpuCalculate {
                online_cpus: 0,
                usage_cpu: 0.0,
            }
        }
    }

    // Obtém estatísticas de rede (RX/TX)
    fn get_network_stats(&self, stats: &ContainerStatsResponse) -> (u64, u64) {
        if let Some(networks) = &stats.networks {
            let mut rx_bytes = 0u64;
            let mut tx_bytes = 0u64;

            // Soma dados de todas as interfaces de rede
            for (_, network) in networks {
                rx_bytes += network.rx_bytes.unwrap_or(0);
                tx_bytes += network.tx_bytes.unwrap_or(0);
            }

            (rx_bytes, tx_bytes)
        } else {
            (0, 0)
        }
    }

    // Obtém estatísticas de I/O de disco
    fn get_block_stats(&self, stats: &ContainerStatsResponse) -> (u64, u64) {
        if let Some(blkio_stats) = &stats.blkio_stats {
            let mut read_bytes = 0u64;
            let mut write_bytes = 0u64;

            // Soma operações de leitura e escrita em disco
            if let Some(io_service_bytes_recursive) = &blkio_stats.io_service_bytes_recursive {
                for entry in io_service_bytes_recursive {
                    if let Some(op) = &entry.op {
                        match op.as_str() {
                            "Read" => read_bytes += entry.value.unwrap_or(0),
                            "Write" => write_bytes += entry.value.unwrap_or(0),
                            _ => {}
                        }
                    }
                }
            }

            (read_bytes, write_bytes)
        } else {
            (0, 0)
        }
    }

    // Função auxiliar para obter limite de memória do sistema
    async fn get_system_memory_limit(&self) -> Result<u64> {
        match self.docker.info().await {
            Ok(info) => {
                // Tenta obter memória total do sistema via Docker info
                Ok(info.mem_total.unwrap_or(0) as u64)
            }
            Err(_) => {
                // Fallback: lê do sistema de arquivos Linux
                self.get_system_memory_from_meminfo()
            }
        }
    }

    // Função para ler memória do sistema via /proc/meminfo (Linux)
    fn get_system_memory_from_meminfo(&self) -> Result<u64> {
        use std::fs;

        match fs::read_to_string("/proc/meminfo") {
            Ok(content) => {
                for line in content.lines() {
                    if line.starts_with("MemTotal:") {
                        if let Some(mem_str) = line.split_whitespace().nth(1) {
                            if let Ok(mem_kb) = mem_str.parse::<u64>() {
                                return Ok(mem_kb * 1024); // Converte KB para bytes
                            }
                        }
                    }
                }
                Ok(0) // Se não conseguir encontrar, retorna 0
            }
            Err(_) => {
                // Se não conseguir ler /proc/meminfo, usa um valor padrão
                // ou retorna erro
                Ok(8_589_934_592) // 8GB como fallback
            }
        }
    }

    pub async fn restart_container(&self, container_id: &str) -> Result<()> {
        self.docker
            .restart_container(container_id, None::<RestartContainerOptions>)
            .await
            .context(format!("Falha ao reiniciar container: {}", container_id))?;

        Ok(())
    }

    // Obter logs de um container com paginação
    pub async fn get_container_logs(
        &self,
        container_name: &str,
        tail_lines: Option<String>,
    ) -> Result<String> {
        use bollard::query_parameters::LogsOptions;
        use futures_util::StreamExt;

        let logs_options = LogsOptions {
            stdout: true,
            stderr: true,
            tail: tail_lines.unwrap_or_else(|| "50".to_string()), // Padrão: últimas 50 linhas
            timestamps: true,
            ..Default::default()
        };

        let mut logs_stream = self.docker.logs(container_name, Some(logs_options));

        let mut logs = String::new();
        while let Some(log_result) = logs_stream.next().await {
            match log_result {
                Ok(log_output) => {
                    logs.push_str(&log_output.to_string());
                }
                Err(_) => break,
            }
        }

        // Processa e formata os logs com timestamp
        let formatted_logs = logs
            .lines()
            .filter_map(|line| {
                if line.len() > 30 {
                    // Tenta extrair o timestamp (formato: 2023-01-01T00:00:00.000000000Z)
                    let timestamp_str = &line[0..30];
                    let message = if line.len() > 31 { &line[31..] } else { "" };

                    // Parse do timestamp ISO 8601 usando chrono
                    if let Ok(utc_time) = timestamp_str.parse::<chrono::DateTime<chrono::Utc>>() {
                        let local_time = utc_time.with_timezone(&chrono::Local);
                        let formatted_time = local_time.format("%H:%M:%S").to_string();
                        Some(format!("[{}] {}", formatted_time, message))
                    } else {
                        // Se não conseguir parsear timestamp, retorna a linha original sem timestamp
                        Some(message.to_string())
                    }
                } else {
                    // Linha muito curta, provavelmente não tem timestamp
                    Some(line.to_string())
                }
            })
            .collect::<Vec<String>>()
            .join("\n");

        Ok(if formatted_logs.trim().is_empty() {
            "Nenhum log disponível".to_string()
        } else {
            formatted_logs
        })
    }

    // Obter estatísticas de um container específico
    pub async fn get_single_container_stats(
        &mut self,
        container_name: &str,
    ) -> Result<(f64, u64, String, String, String)> {
        use bollard::query_parameters::StatsOptions;
        use futures_util::StreamExt;

        let stats_options = Some(StatsOptions {
            stream: false,
            one_shot: true,
        });

        let mut stats_stream = self.docker.stats(container_name, stats_options);

        if let Some(stats_result) = stats_stream.next().await {
            match stats_result {
                Ok(stats) => {
                    // Calcula CPU usando função existente
                    let current_time = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs();
                    let cpu_calc = self.calculate_cpu_percentage_with_cache(
                        container_name,
                        &stats,
                        current_time,
                    );
                    let cpu_usage = cpu_calc.usage_cpu;
                    let cpu_online = cpu_calc.online_cpus;

                    // Calcula memória
                    let memory_stats = stats.memory_stats.as_ref().cloned().unwrap_or_default();
                    let memory_usage = memory_stats.usage.unwrap_or(0);
                    let memory_limit = memory_stats.limit.unwrap_or(0);

                    let memory_usage_mb = memory_usage as f64 / 1024.0 / 1024.0;
                    let memory_limit_mb = memory_limit as f64 / 1024.0 / 1024.0;
                    let memory_percentage = if memory_limit > 0 {
                        (memory_usage as f64 / memory_limit as f64) * 100.0
                    } else {
                        0.0
                    };

                    let memory_str = if memory_usage_mb >= 1024.0 || memory_limit_mb >= 1024.0 {
                        let memory_usage_gb = memory_usage_mb / 1024.0;
                        let memory_limit_gb = memory_limit_mb / 1024.0;

                        if memory_usage_mb >= 1024.0 && memory_limit_mb >= 1024.0 {
                            format!(
                                "{:.1}% ({:.1} GB / {:.1} GB)",
                                memory_percentage, memory_usage_gb, memory_limit_gb
                            )
                        } else if memory_usage_mb >= 1024.0 {
                            format!(
                                "{:.1}% ({:.1} GB / {:.0} MB)",
                                memory_percentage, memory_usage_gb, memory_limit_mb
                            )
                        } else {
                            format!(
                                "{:.1}% ({:.0} MB / {:.1} GB)",
                                memory_percentage, memory_usage_mb, memory_limit_gb
                            )
                        }
                    } else {
                        format!(
                            "{:.1}% ({:.0} MB / {:.0} MB)",
                            memory_percentage, memory_usage_mb, memory_limit_mb
                        )
                    };

                    // Calcula network
                    let (rx, tx) = self.get_network_stats(&stats);
                    let rx_str = self.format_bytes_rate(rx);
                    let tx_str = self.format_bytes_rate(tx);

                    Ok((cpu_usage, cpu_online, memory_str, rx_str, tx_str))
                }
                Err(e) => Err(anyhow::anyhow!("Erro ao obter stats do container: {}", e)),
            }
        } else {
            Err(anyhow::anyhow!("Nenhum stat recebido para o container"))
        }
    }

    // Função auxiliar para formatar bytes/s
    fn format_bytes_rate(&self, bytes: u64) -> String {
        if bytes < 1024 {
            format!("{} B/s", bytes)
        } else if bytes < 1024 * 1024 {
            format!("{:.1} KB/s", bytes as f64 / 1024.0)
        } else {
            format!("{:.1} MB/s", bytes as f64 / 1024.0 / 1024.0)
        }
    }

    // Cria um novo container
    pub async fn create_container(&self, request: CreateContainerRequest) -> Result<String> {
        use bollard::models::{
            HostConfig, Mount, MountTypeEnum, PortBinding, RestartPolicy, RestartPolicyNameEnum,
        };
        use std::collections::HashMap;

        // Verifica se o nome já existe
        if self.container_name_exists(&request.name).await? {
            return Err(anyhow::anyhow!(
                "Container com nome '{}' já existe",
                request.name
            ));
        }

        // Verifica se a imagem existe localmente, se não, tenta fazer pull
        if !self.image_exists(&request.image).await? {
            // Aqui podemos adicionar callback de progresso no futuro
            self.pull_image(&request.image).await?;
        }

        // Configura mapeamento de portas
        let mut port_bindings: HashMap<String, Option<Vec<PortBinding>>> = HashMap::new();
        let mut exposed_ports: HashMap<String, HashMap<(), ()>> = HashMap::new();

        for port_map in &request.ports {
            let container_port_key = format!("{}/{}", port_map.container_port, port_map.protocol);
            port_bindings.insert(
                container_port_key.clone(),
                Some(vec![PortBinding {
                    host_ip: Some("0.0.0.0".to_string()),
                    host_port: Some(port_map.host_port.to_string()),
                }]),
            );
            exposed_ports.insert(container_port_key, HashMap::new());
        }

        // Configura volumes/mounts
        let mut mounts = Vec::new();
        for volume_map in &request.volumes {
            mounts.push(Mount {
                target: Some(volume_map.container_path.clone()),
                source: Some(volume_map.host_path.clone()),
                typ: Some(MountTypeEnum::BIND),
                read_only: Some(volume_map.read_only),
                ..Default::default()
            });
        }

        // Configura variáveis de ambiente
        let env: Vec<String> = request
            .environment
            .iter()
            .map(|var| format!("{}={}", var.key, var.value))
            .collect();

        // Configura política de restart
        let restart_policy = match request.restart_policy.as_str() {
            "always" => Some(RestartPolicy {
                name: Some(RestartPolicyNameEnum::ALWAYS),
                maximum_retry_count: None,
            }),
            "unless-stopped" => Some(RestartPolicy {
                name: Some(RestartPolicyNameEnum::UNLESS_STOPPED),
                maximum_retry_count: None,
            }),
            "on-failure" => Some(RestartPolicy {
                name: Some(RestartPolicyNameEnum::ON_FAILURE),
                maximum_retry_count: Some(3),
            }),
            _ => Some(RestartPolicy {
                name: Some(RestartPolicyNameEnum::EMPTY),
                maximum_retry_count: None,
            }),
        };

        // Configura comando se especificado
        let cmd = request.command.as_ref().map(|c| {
            c.split_whitespace()
                .map(|s| s.to_string())
                .collect::<Vec<String>>()
        });

        // Cria configuração do container
        let config = ContainerCreateBody {
            image: Some(request.image.clone()),
            env: Some(env),
            cmd,
            exposed_ports: Some(exposed_ports),
            host_config: Some(HostConfig {
                port_bindings: Some(port_bindings),
                mounts: Some(mounts),
                restart_policy,
                ..Default::default()
            }),
            ..Default::default()
        };

        let options = CreateContainerOptions {
            name: Some(request.name.clone()),
            ..Default::default()
        };

        // Cria o container
        let response = self
            .docker
            .create_container(Some(options), config)
            .await
            .context("Falha ao criar container")?;

        // Inicia o container automaticamente
        self.start_container(&response.id)
            .await
            .context("Container criado mas falha ao iniciar")?;

        Ok(response.id)
    }

    // Verifica se um container com o nome existe
    async fn container_name_exists(&self, name: &str) -> Result<bool> {
        let containers = self.list_containers().await?;
        Ok(containers.iter().any(|c| c.name == name))
    }

    // Verifica se uma imagem existe localmente
    async fn image_exists(&self, image_name: &str) -> Result<bool> {
        let images = self.list_images().await?;
        Ok(images.iter().any(|img| {
            let full_name = if img.tag == "latest" {
                img.repository.clone()
            } else {
                format!("{}:{}", img.repository, img.tag)
            };
            full_name == image_name || img.repository == image_name
        }))
    }

    // Faz pull de uma imagem
    pub async fn pull_image(&self, image_name: &str) -> Result<()> {
        use bollard::query_parameters::CreateImageOptions;
        use futures_util::StreamExt;

        let options = CreateImageOptions {
            from_image: Some(image_name.to_string()),
            ..Default::default()
        };

        let mut stream = self.docker.create_image(Some(options), None, None);

        while let Some(result) = stream.next().await {
            match result {
                Ok(_) => {
                    // Pull em progresso
                }
                Err(e) => {
                    return Err(anyhow::anyhow!(
                        "Falha ao fazer pull da imagem '{}': {}",
                        image_name,
                        e
                    ));
                }
            }
        }

        Ok(())
    }
}
