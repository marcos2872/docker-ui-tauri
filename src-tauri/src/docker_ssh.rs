use crate::client_ssh::SshClient;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fmt;

// Informações básicas de um container via SSH
#[derive(Debug, Serialize, Deserialize)]
pub struct SshContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    pub ports: Vec<String>,
    pub created: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshImageInfo {
    pub id: String,
    pub repository: String,
    pub tag: String,
    pub created: String,
    pub size: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshNetworkInfo {
    pub id: String,
    pub name: String,
    pub driver: String,
    pub scope: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshVolumeInfo {
    pub name: String,
    pub driver: String,
    pub mountpoint: String,
}

// Status possíveis do Docker via SSH
#[derive(Debug, Serialize, Deserialize)]
pub enum SshDockerStatus {
    Running,
    NotRunning,
    NotInstalled,
    SshNotConnected,
}

impl fmt::Display for SshDockerStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SshDockerStatus::Running => write!(f, "Rodando"),
            SshDockerStatus::NotRunning => write!(f, "Não está rodando"),
            SshDockerStatus::NotInstalled => write!(f, "Não instalado"),
            SshDockerStatus::SshNotConnected => write!(f, "SSH não conectado"),
        }
    }
}

// Informações gerais do sistema Docker via SSH
#[derive(Debug, Serialize, Deserialize)]
pub struct SshDockerInfo {
    pub version: String,
    pub server_version: String,
    pub containers_total: i32,
    pub containers_running: i32,
    pub containers_paused: i32,
    pub containers_stopped: i32,
    pub images: i32,
    pub architecture: String,
    pub os: String,
    pub kernel_version: String,
}

// Uso do sistema Docker via SSH
#[derive(Debug, Serialize, Deserialize)]
pub struct SshDockerSystemUsage {
    pub containers_running: i32,
    pub containers_total: i32,
    pub images_total: i32,
    pub system_info: String,
}

// Estrutura para criar um novo container via SSH
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshCreateContainerRequest {
    pub name: String,
    pub image: String,
    pub ports: Vec<SshPortMapping>,
    pub volumes: Vec<SshVolumeMapping>,
    pub environment: Vec<SshEnvVar>,
    pub command: Option<String>,
    pub restart_policy: String,
    pub detach: bool,
}

// Mapeamento de portas via SSH
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshPortMapping {
    pub host_port: u16,
    pub container_port: u16,
    pub protocol: String, // tcp ou udp
}

// Mapeamento de volumes via SSH
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshVolumeMapping {
    pub host_path: String,
    pub container_path: String,
    pub read_only: bool,
}

// Variável de ambiente via SSH
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshEnvVar {
    pub key: String,
    pub value: String,
}

// Gerenciador Docker via SSH
pub struct SshDockerManager<'a> {
    ssh_client: &'a SshClient,
}

impl<'a> SshDockerManager<'a> {
    pub fn new(ssh_client: &'a SshClient) -> Self {
        Self { ssh_client }
    }

    // Verifica status do Docker via SSH
    pub async fn check_docker_status(&self, connection_id: &str) -> Result<SshDockerStatus> {
        // Primeiro verifica se Docker está instalado
        let version_result = self
            .ssh_client
            .execute_command(connection_id, "docker --version")
            .await;

        match version_result {
            Ok(_) => {
                // Docker instalado, verifica se está rodando
                let info_result = self
                    .ssh_client
                    .execute_command(connection_id, "docker info")
                    .await;

                match info_result {
                    Ok(_) => Ok(SshDockerStatus::Running),
                    Err(error) => {
                        let error_msg = error.to_lowercase();
                        if error_msg.contains("cannot connect to the docker daemon")
                            || error_msg.contains("is the docker daemon running")
                        {
                            Ok(SshDockerStatus::NotRunning)
                        } else {
                            Ok(SshDockerStatus::NotRunning)
                        }
                    }
                }
            }
            Err(error) => {
                let error_msg = error.to_lowercase();
                if error_msg.contains("command not found")
                    || error_msg.contains("not found")
                    || error_msg.contains("no such file")
                {
                    Ok(SshDockerStatus::NotInstalled)
                } else {
                    Ok(SshDockerStatus::SshNotConnected)
                }
            }
        }
    }

    // Obtém informações gerais do Docker via SSH
    pub async fn get_docker_info(&self, connection_id: &str) -> Result<SshDockerInfo> {
        let version_output = self
            .ssh_client
            .execute_command(connection_id, "docker version --format '{{.Client.Version}}|{{.Server.Version}}|{{.Client.Arch}}|{{.Client.Os}}'")
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao obter versão do Docker: {}", e))?;

        let info_output = self
            .ssh_client
            .execute_command(connection_id, "docker info --format '{{.Containers}}|{{.ContainersRunning}}|{{.ContainersPaused}}|{{.ContainersStopped}}|{{.Images}}|{{.KernelVersion}}'")
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao obter informações do Docker: {}", e))?;

        let version_parts: Vec<&str> = version_output.trim().split('|').collect();
        let info_parts: Vec<&str> = info_output.trim().split('|').collect();

        Ok(SshDockerInfo {
            version: version_parts.get(0).unwrap_or(&"unknown").to_string(),
            server_version: version_parts.get(1).unwrap_or(&"unknown").to_string(),
            containers_total: info_parts.get(0).unwrap_or(&"0").parse().unwrap_or(0),
            containers_running: info_parts.get(1).unwrap_or(&"0").parse().unwrap_or(0),
            containers_paused: info_parts.get(2).unwrap_or(&"0").parse().unwrap_or(0),
            containers_stopped: info_parts.get(3).unwrap_or(&"0").parse().unwrap_or(0),
            images: info_parts.get(4).unwrap_or(&"0").parse().unwrap_or(0),
            architecture: version_parts.get(2).unwrap_or(&"unknown").to_string(),
            os: version_parts.get(3).unwrap_or(&"unknown").to_string(),
            kernel_version: info_parts.get(5).unwrap_or(&"unknown").to_string(),
        })
    }

    // Lista todos os containers via SSH
    pub async fn list_containers(&self, connection_id: &str) -> Result<Vec<SshContainerInfo>> {
        let output = self
            .ssh_client
            .execute_command(
                connection_id,
                "docker ps -a --format 'table {{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}'",
            )
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao listar containers: {}", e))?;

        let mut containers = Vec::new();
        for line in output.lines().skip(1) {
            // Skip header
            if line.trim().is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 6 {
                containers.push(SshContainerInfo {
                    id: parts[0].trim().to_string(),
                    name: parts[1].trim().to_string(),
                    image: parts[2].trim().to_string(),
                    state: parts[3].trim().to_string(),
                    status: parts[4].trim().to_string(),
                    ports: parts[5]
                        .trim()
                        .split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect(),
                    created: parts.get(6).unwrap_or(&"").trim().to_string(),
                });
            }
        }

        Ok(containers)
    }

    // Inicia um container via SSH
    pub async fn start_container(&self, connection_id: &str, container_name: &str) -> Result<()> {
        let command = format!("docker start {}", container_name);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao iniciar container: {}", e))?;
        Ok(())
    }

    // Para um container via SSH
    pub async fn stop_container(&self, connection_id: &str, container_name: &str) -> Result<()> {
        let command = format!("docker stop {}", container_name);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao parar container: {}", e))?;
        Ok(())
    }

    // Pausa um container via SSH
    pub async fn pause_container(&self, connection_id: &str, container_name: &str) -> Result<()> {
        let command = format!("docker pause {}", container_name);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao pausar container: {}", e))?;
        Ok(())
    }

    // Despausa um container via SSH
    pub async fn unpause_container(&self, connection_id: &str, container_name: &str) -> Result<()> {
        let command = format!("docker unpause {}", container_name);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao despausar container: {}", e))?;
        Ok(())
    }

    // Remove um container via SSH
    pub async fn remove_container(&self, connection_id: &str, container_name: &str) -> Result<()> {
        let command = format!("docker rm {}", container_name);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao remover container: {}", e))?;
        Ok(())
    }

    // Reinicia um container via SSH
    pub async fn restart_container(&self, connection_id: &str, container_name: &str) -> Result<()> {
        let command = format!("docker restart {}", container_name);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao reiniciar container: {}", e))?;
        Ok(())
    }

    // Lista todas as imagens via SSH
    pub async fn list_images(&self, connection_id: &str) -> Result<Vec<SshImageInfo>> {
        let output = self
            .ssh_client
            .execute_command(
                connection_id,
                "docker images --format 'table {{.ID}}|{{.Repository}}|{{.Tag}}|{{.CreatedAt}}|{{.Size}}'",
            )
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao listar imagens: {}", e))?;

        let mut images = Vec::new();
        for line in output.lines().skip(1) {
            // Skip header
            if line.trim().is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 5 {
                images.push(SshImageInfo {
                    id: parts[0].trim().to_string(),
                    repository: parts[1].trim().to_string(),
                    tag: parts[2].trim().to_string(),
                    created: parts[3].trim().to_string(),
                    size: parts[4].trim().to_string(),
                });
            }
        }

        Ok(images)
    }

    // Remove uma imagem via SSH
    pub async fn remove_image(&self, connection_id: &str, image_id: &str) -> Result<()> {
        let command = format!("docker rmi {}", image_id);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao remover imagem: {}", e))?;
        Ok(())
    }

    // Faz pull de uma imagem via SSH
    pub async fn pull_image(&self, connection_id: &str, image_name: &str) -> Result<()> {
        let command = format!("docker pull {}", image_name);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao fazer pull da imagem: {}", e))?;
        Ok(())
    }

    // Lista todas as networks via SSH
    pub async fn list_networks(&self, connection_id: &str) -> Result<Vec<SshNetworkInfo>> {
        let output = self
            .ssh_client
            .execute_command(
                connection_id,
                "docker network ls --format 'table {{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}'",
            )
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao listar networks: {}", e))?;

        let mut networks = Vec::new();
        for line in output.lines().skip(1) {
            // Skip header
            if line.trim().is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 4 {
                let name = parts[1].trim();
                // Filtrar networks de sistema
                if !matches!(name, "bridge" | "host" | "none") {
                    networks.push(SshNetworkInfo {
                        id: parts[0].trim().to_string(),
                        name: name.to_string(),
                        driver: parts[2].trim().to_string(),
                        scope: parts[3].trim().to_string(),
                    });
                }
            }
        }

        Ok(networks)
    }

    // Remove uma network via SSH
    pub async fn remove_network(&self, connection_id: &str, network_id: &str) -> Result<()> {
        let command = format!("docker network rm {}", network_id);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao remover network: {}", e))?;
        Ok(())
    }

    // Cria uma nova network via SSH
    pub async fn create_network(
        &self,
        connection_id: &str,
        network_name: &str,
        driver: &str,
    ) -> Result<()> {
        let command = format!("docker network create --driver {} {}", driver, network_name);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao criar network: {}", e))?;
        Ok(())
    }

    // Lista todos os volumes via SSH
    pub async fn list_volumes(&self, connection_id: &str) -> Result<Vec<SshVolumeInfo>> {
        let output = self
            .ssh_client
            .execute_command(
                connection_id,
                "docker volume ls --format 'table {{.Name}}|{{.Driver}}|{{.Mountpoint}}'",
            )
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao listar volumes: {}", e))?;

        let mut volumes = Vec::new();
        for line in output.lines().skip(1) {
            // Skip header
            if line.trim().is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 3 {
                volumes.push(SshVolumeInfo {
                    name: parts[0].trim().to_string(),
                    driver: parts[1].trim().to_string(),
                    mountpoint: parts[2].trim().to_string(),
                });
            }
        }

        Ok(volumes)
    }

    // Remove um volume via SSH
    pub async fn remove_volume(&self, connection_id: &str, volume_name: &str) -> Result<()> {
        let command = format!("docker volume rm {}", volume_name);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao remover volume: {}", e))?;
        Ok(())
    }

    // Cria um novo volume via SSH
    pub async fn create_volume(
        &self,
        connection_id: &str,
        volume_name: &str,
        driver: &str,
    ) -> Result<()> {
        let command = format!("docker volume create --driver {} {}", driver, volume_name);
        self.ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao criar volume: {}", e))?;
        Ok(())
    }

    // Obtém logs de um container via SSH
    pub async fn get_container_logs(
        &self,
        connection_id: &str,
        container_name: &str,
        tail_lines: Option<String>,
    ) -> Result<String> {
        let tail = tail_lines.unwrap_or_else(|| "50".to_string());
        let command = format!(
            "docker logs --tail {} --timestamps {}",
            tail, container_name
        );

        let output = self
            .ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao obter logs do container: {}", e))?;

        if output.trim().is_empty() {
            Ok("Nenhum log disponível".to_string())
        } else {
            Ok(output)
        }
    }

    // Obtém uso do sistema Docker via SSH
    pub async fn get_docker_system_usage(
        &self,
        connection_id: &str,
    ) -> Result<SshDockerSystemUsage> {
        let containers = self.list_containers(connection_id).await?;
        let running_containers = containers
            .iter()
            .filter(|c| c.state.to_lowercase() == "running")
            .count() as i32;

        let images = self.list_images(connection_id).await?;
        let images_count = images.len() as i32;

        // Obtém informações do sistema
        let system_info = self
            .ssh_client
            .execute_command(connection_id, "uname -a")
            .await
            .unwrap_or_else(|_| "Sistema desconhecido".to_string());

        Ok(SshDockerSystemUsage {
            containers_running: running_containers,
            containers_total: containers.len() as i32,
            images_total: images_count,
            system_info: system_info.trim().to_string(),
        })
    }

    // Cria um novo container via SSH
    pub async fn create_container(
        &self,
        connection_id: &str,
        request: SshCreateContainerRequest,
    ) -> Result<String> {
        let mut command = format!("docker run");

        // Adiciona nome
        if !request.name.is_empty() {
            command.push_str(&format!(" --name {}", request.name));
        }

        // Adiciona modo detached
        if request.detach {
            command.push_str(" -d");
        }

        // Adiciona mapeamento de portas
        for port in &request.ports {
            command.push_str(&format!(
                " -p {}:{}/{}",
                port.host_port, port.container_port, port.protocol
            ));
        }

        // Adiciona volumes
        for volume in &request.volumes {
            let ro_flag = if volume.read_only { ":ro" } else { "" };
            command.push_str(&format!(
                " -v {}:{}{}",
                volume.host_path, volume.container_path, ro_flag
            ));
        }

        // Adiciona variáveis de ambiente
        for env in &request.environment {
            command.push_str(&format!(" -e {}={}", env.key, env.value));
        }

        // Adiciona política de restart
        if !request.restart_policy.is_empty() && request.restart_policy != "no" {
            command.push_str(&format!(" --restart {}", request.restart_policy));
        }

        // Adiciona imagem
        command.push_str(&format!(" {}", request.image));

        // Adiciona comando customizado
        if let Some(cmd) = &request.command {
            command.push_str(&format!(" {}", cmd));
        }

        let output = self
            .ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao criar container: {}", e))?;

        // Retorna o ID do container (primeira linha da saída)
        let container_id = output.lines().next().unwrap_or("").trim().to_string();
        Ok(container_id)
    }

    // Executa comando customizado em um container via SSH
    pub async fn exec_container_command(
        &self,
        connection_id: &str,
        container_name: &str,
        command: &str,
    ) -> Result<String> {
        let exec_command = format!("docker exec {} {}", container_name, command);
        self.ssh_client
            .execute_command(connection_id, &exec_command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao executar comando no container: {}", e))
    }

    // Obtém estatísticas básicas de um container via SSH
    pub async fn get_container_stats(
        &self,
        connection_id: &str,
        container_name: &str,
    ) -> Result<String> {
        let command = format!(
            "docker stats {} --no-stream --format 'table {{.Container}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}'",
            container_name
        );

        let output = self
            .ssh_client
            .execute_command(connection_id, &command)
            .await
            .map_err(|e| anyhow::anyhow!("Falha ao obter estatísticas do container: {}", e))?;

        Ok(output)
    }
}
