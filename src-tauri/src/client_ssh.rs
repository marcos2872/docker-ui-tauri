use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;
use tokio::time::timeout;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConnectionInfo {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub connection_id: String,
    pub connected_at: u64,
    pub last_activity: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConnectionRequest {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSshConnection {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub name: Option<String>, // Nome personalizado para a conexão
}

struct SshConnection {
    pub info: SshConnectionInfo,
    pub session: Option<ssh2::Session>,
    pub tcp_stream: Option<std::net::TcpStream>,
}

pub struct SshClient {
    connections: Mutex<HashMap<String, SshConnection>>,
    connection_counter: AtomicU64,
    saved_connections: Mutex<Vec<SavedSshConnection>>,
    config_path: PathBuf,
}

impl SshClient {
    pub fn new() -> Self {
        let config_path = Self::get_config_path();
        let saved_connections = Self::load_saved_connections(&config_path);

        Self {
            connections: Mutex::new(HashMap::new()),
            connection_counter: AtomicU64::new(0),
            saved_connections: Mutex::new(saved_connections),
            config_path,
        }
    }

    fn get_config_path() -> PathBuf {
        let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("docker-ui-tauri");
        if !path.exists() {
            let _ = fs::create_dir_all(&path);
        }
        path.push("ssh_connections.json");
        path
    }

    fn load_saved_connections(config_path: &PathBuf) -> Vec<SavedSshConnection> {
        if config_path.exists() {
            match fs::read_to_string(config_path) {
                Ok(content) => match serde_json::from_str(&content) {
                    Ok(connections) => connections,
                    Err(_) => Vec::new(),
                },
                Err(_) => Vec::new(),
            }
        } else {
            Vec::new()
        }
    }

    async fn save_connections(&self) -> Result<(), String> {
        let connections = self.saved_connections.lock().await;
        let json = serde_json::to_string_pretty(&*connections)
            .map_err(|e| format!("Failed to serialize connections: {}", e))?;

        fs::write(&self.config_path, json)
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        Ok(())
    }

    fn generate_connection_id(&self) -> String {
        let id = self.connection_counter.fetch_add(1, Ordering::SeqCst);
        format!("ssh_conn_{}", id)
    }

    fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or(Duration::from_secs(0))
            .as_secs()
    }

    pub async fn test_connection(&self, request: &SshConnectionRequest) -> Result<String, String> {
        let timeout_duration = Duration::from_secs(10);

        let connection_result = timeout(timeout_duration, async {
            self.create_ssh_session(
                &request.host,
                request.port,
                &request.username,
                &request.password,
            )
            .await
        })
        .await;

        match connection_result {
            Ok(Ok(_)) => Ok(format!(
                "Connection test successful to {}@{}:{}",
                request.username, request.host, request.port
            )),
            Ok(Err(e)) => Err(format!("Connection test failed: {}", e)),
            Err(_) => Err("Connection test timed out".to_string()),
        }
    }

    pub async fn connect(&self, request: SshConnectionRequest) -> Result<String, String> {
        let connection_id = self.generate_connection_id();
        let current_time = Self::current_timestamp();

        // Criar a sessão SSH
        let (session, tcp_stream) = self
            .create_ssh_session(
                &request.host,
                request.port,
                &request.username,
                &request.password,
            )
            .await?;

        let connection_info = SshConnectionInfo {
            host: request.host.clone(),
            port: request.port,
            username: request.username.clone(),
            connection_id: connection_id.clone(),
            connected_at: current_time,
            last_activity: current_time,
        };

        // Salvar a conexão para persistência (sem a senha)
        let saved_connection = SavedSshConnection {
            host: request.host,
            port: request.port,
            username: request.username,
            name: None,
        };

        let _ = self.add_saved_connection(saved_connection).await;

        let connection = SshConnection {
            info: connection_info,
            session: Some(session),
            tcp_stream: Some(tcp_stream),
        };

        // Armazenar a conexão
        let mut connections = self.connections.lock().await;
        connections.insert(connection_id.clone(), connection);

        Ok(connection_id)
    }

    pub async fn disconnect(&self, connection_id: &str) -> Result<String, String> {
        let mut connections = self.connections.lock().await;

        if let Some(mut connection) = connections.remove(connection_id) {
            // Fechar a sessão SSH se existir
            if let Some(session) = connection.session.take() {
                let _ = session.disconnect(None, "User disconnected", None);
            }

            // Fechar o stream TCP se existir
            if let Some(_tcp_stream) = connection.tcp_stream.take() {
                // O stream será automaticamente fechado quando sair de escopo
            }

            Ok(format!(
                "Successfully disconnected from {}",
                connection.info.host
            ))
        } else {
            Err("Connection not found".to_string())
        }
    }

    pub async fn disconnect_all(&self) -> Result<String, String> {
        let mut connections = self.connections.lock().await;
        let count = connections.len();

        for (_, mut connection) in connections.drain() {
            if let Some(session) = connection.session.take() {
                let _ = session.disconnect(None, "Disconnecting all connections", None);
            }
        }

        Ok(format!("Disconnected {} connections", count))
    }

    pub async fn list_connections(&self) -> Result<Vec<SshConnectionInfo>, String> {
        let connections = self.connections.lock().await;
        let connection_infos: Vec<SshConnectionInfo> =
            connections.values().map(|conn| conn.info.clone()).collect();

        Ok(connection_infos)
    }

    pub async fn get_connection_info(
        &self,
        connection_id: &str,
    ) -> Result<SshConnectionInfo, String> {
        let connections = self.connections.lock().await;

        if let Some(connection) = connections.get(connection_id) {
            Ok(connection.info.clone())
        } else {
            Err("Connection not found".to_string())
        }
    }

    pub async fn is_connected(&self, connection_id: &str) -> Result<bool, String> {
        let connections = self.connections.lock().await;

        if let Some(connection) = connections.get(connection_id) {
            // Verificar se a sessão ainda está ativa
            if let Some(session) = &connection.session {
                Ok(!session.is_blocking())
            } else {
                Ok(false)
            }
        } else {
            Ok(false)
        }
    }

    async fn create_ssh_session(
        &self,
        host: &str,
        port: u16,
        username: &str,
        password: &str,
    ) -> Result<(ssh2::Session, std::net::TcpStream), String> {
        use std::net::TcpStream;

        // Conectar via TCP
        let tcp_address = format!("{}:{}", host, port);
        let tcp_stream = TcpStream::connect(&tcp_address)
            .map_err(|e| format!("Failed to connect to {}: {}", tcp_address, e))?;

        // Criar sessão SSH
        let mut session =
            ssh2::Session::new().map_err(|e| format!("Failed to create SSH session: {}", e))?;

        session.set_tcp_stream(tcp_stream.try_clone().unwrap());

        // Realizar handshake
        session
            .handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        // Autenticar com usuário e senha
        session
            .userauth_password(username, password)
            .map_err(|e| format!("Authentication failed: {}", e))?;

        if !session.authenticated() {
            return Err("Authentication failed: Invalid credentials".to_string());
        }

        Ok((session, tcp_stream))
    }

    pub async fn execute_command(
        &self,
        connection_id: &str,
        command: &str,
    ) -> Result<String, String> {
        let mut connections = self.connections.lock().await;

        if let Some(connection) = connections.get_mut(connection_id) {
            // Atualizar última atividade
            connection.info.last_activity = Self::current_timestamp();

            if let Some(session) = &connection.session {
                let mut channel = session
                    .channel_session()
                    .map_err(|e| format!("Failed to create channel: {}", e))?;

                channel
                    .exec(command)
                    .map_err(|e| format!("Failed to execute command: {}", e))?;

                let mut output = String::new();
                channel
                    .read_to_string(&mut output)
                    .map_err(|e| format!("Failed to read command output: {}", e))?;

                channel
                    .wait_close()
                    .map_err(|e| format!("Failed to close channel: {}", e))?;

                let exit_status = channel
                    .exit_status()
                    .map_err(|e| format!("Failed to get exit status: {}", e))?;

                if exit_status == 0 {
                    Ok(output)
                } else {
                    Err(format!(
                        "Command failed with exit status {}: {}",
                        exit_status, output
                    ))
                }
            } else {
                Err("No active SSH session".to_string())
            }
        } else {
            Err("Connection not found".to_string())
        }
    }

    pub async fn cleanup_inactive_connections(
        &self,
        max_idle_minutes: u64,
    ) -> Result<usize, String> {
        let mut connections = self.connections.lock().await;
        let current_time = Self::current_timestamp();
        let max_idle_seconds = max_idle_minutes * 60;
        let mut removed_count = 0;

        let mut to_remove = Vec::new();

        for (connection_id, connection) in connections.iter() {
            if current_time - connection.info.last_activity > max_idle_seconds {
                to_remove.push(connection_id.clone());
            }
        }

        for connection_id in to_remove {
            if let Some(mut connection) = connections.remove(&connection_id) {
                if let Some(session) = connection.session.take() {
                    let _ = session.disconnect(None, "Idle timeout", None);
                }
                removed_count += 1;
            }
        }

        Ok(removed_count)
    }

    pub async fn add_saved_connection(&self, connection: SavedSshConnection) -> Result<(), String> {
        let mut saved_connections = self.saved_connections.lock().await;

        // Sempre adicionar nova conexão (sem verificação de duplicatas)
        saved_connections.push(connection);

        drop(saved_connections);
        self.save_connections().await?;
        Ok(())
    }

    pub async fn remove_saved_connection(
        &self,
        host: &str,
        port: u16,
        username: &str,
    ) -> Result<(), String> {
        let mut saved_connections = self.saved_connections.lock().await;
        saved_connections
            .retain(|conn| !(conn.host == host && conn.port == port && conn.username == username));
        drop(saved_connections);
        self.save_connections().await
    }

    pub async fn get_saved_connections(&self) -> Vec<SavedSshConnection> {
        let saved_connections = self.saved_connections.lock().await;
        saved_connections.clone()
    }

    pub async fn update_saved_connection_name(
        &self,
        host: &str,
        port: u16,
        username: &str,
        name: Option<String>,
    ) -> Result<(), String> {
        let mut saved_connections = self.saved_connections.lock().await;

        if let Some(connection) = saved_connections
            .iter_mut()
            .find(|conn| conn.host == host && conn.port == port && conn.username == username)
        {
            connection.name = name;
            drop(saved_connections);
            self.save_connections().await?;
        }

        Ok(())
    }
}

impl Default for SshClient {
    fn default() -> Self {
        Self::new()
    }
}
