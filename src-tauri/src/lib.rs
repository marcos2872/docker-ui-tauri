use crate::client_ssh::{SavedSshConnection, SshClient, SshConnectionInfo, SshConnectionRequest};
use crate::docker_ssh::{
    SshContainerInfo, SshCreateContainerRequest, SshDockerInfo, SshDockerManager, SshDockerStatus,
    SshDockerSystemUsage, SshImageInfo, SshNetworkInfo, SshVolumeInfo,
};
use tauri::State;
use tokio::sync::Mutex;

mod client_ssh;
mod docker_ssh;

// Global SSH Client para gerenciar conexões SSH
type SshClientState = Mutex<SshClient>;

// Comandos Docker removidos - usando apenas SSH commands

#[tauri::command]
async fn ssh_test_connection(
    state: State<'_, SshClientState>,
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let request = SshConnectionRequest {
        host,
        port,
        username,
        password,
    };
    ssh_client.test_connection(&request).await
}

#[tauri::command]
async fn ssh_connect(
    state: State<'_, SshClientState>,
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;

    let request = SshConnectionRequest {
        host: host.clone(),
        port,
        username: username.clone(),
        password,
    };

    // Use the connect method to create actual SSH session
    let connection_id = ssh_client.connect(request).await?;

    Ok(connection_id)
}

#[tauri::command]
async fn ssh_disconnect(
    state: State<'_, SshClientState>,
    connection_id: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    ssh_client.disconnect(&connection_id).await
}

#[tauri::command]
async fn ssh_disconnect_all(state: State<'_, SshClientState>) -> Result<String, String> {
    let ssh_client = state.lock().await;
    ssh_client.disconnect_all().await
}

#[tauri::command]
async fn ssh_list_connections(
    state: State<'_, SshClientState>,
) -> Result<Vec<SshConnectionInfo>, String> {
    let ssh_client = state.lock().await;
    ssh_client.list_connections().await
}

#[tauri::command]
async fn ssh_get_connection_info(
    state: State<'_, SshClientState>,
    connection_id: String,
) -> Result<SshConnectionInfo, String> {
    let ssh_client = state.lock().await;
    ssh_client.get_connection_info(&connection_id).await
}

#[tauri::command]
async fn ssh_is_connected(
    state: State<'_, SshClientState>,
    connection_id: String,
) -> Result<bool, String> {
    let ssh_client = state.lock().await;
    ssh_client.is_connected(&connection_id).await
}

#[tauri::command]
async fn ssh_execute_command(
    state: State<'_, SshClientState>,
    connection_id: String,
    command: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    ssh_client.execute_command(&connection_id, &command).await
}

#[tauri::command]
async fn ssh_cleanup_inactive_connections(
    state: State<'_, SshClientState>,
    max_idle_minutes: u64,
) -> Result<usize, String> {
    let ssh_client = state.lock().await;
    ssh_client
        .cleanup_inactive_connections(max_idle_minutes)
        .await
}

#[tauri::command]
async fn ssh_get_saved_connections(
    state: State<'_, SshClientState>,
) -> Result<Vec<SavedSshConnection>, String> {
    let ssh_client = state.lock().await;
    Ok(ssh_client.get_saved_connections().await)
}

#[tauri::command]
async fn ssh_add_saved_connection(
    state: State<'_, SshClientState>,
    host: String,
    port: u16,
    username: String,
    name: Option<String>,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let connection = SavedSshConnection {
        host,
        port,
        username,
        name,
    };
    ssh_client.add_saved_connection(connection).await?;
    Ok("Conexão salva com sucesso".to_string())
}

#[tauri::command]
async fn ssh_remove_saved_connection(
    state: State<'_, SshClientState>,
    host: String,
    port: u16,
    username: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    ssh_client
        .remove_saved_connection(&host, port, &username)
        .await?;
    Ok("Conexão removida com sucesso".to_string())
}

#[tauri::command]
async fn ssh_update_saved_connection_name(
    state: State<'_, SshClientState>,
    host: String,
    port: u16,
    username: String,
    name: Option<String>,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    ssh_client
        .update_saved_connection_name(&host, port, &username, name)
        .await?;
    Ok("Nome da conexão atualizado com sucesso".to_string())
}

// Comandos Docker SSH
#[tauri::command]
async fn ssh_docker_status(
    state: State<'_, SshClientState>,
    connection_id: String,
) -> Result<SshDockerStatus, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .check_docker_status(&connection_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_docker_info(
    state: State<'_, SshClientState>,
    connection_id: String,
) -> Result<SshDockerInfo, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .get_docker_info(&connection_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_docker_system_usage(
    state: State<'_, SshClientState>,
    connection_id: String,
) -> Result<SshDockerSystemUsage, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .get_docker_system_usage(&connection_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_docker_list_containers(
    state: State<'_, SshClientState>,
    connection_id: String,
) -> Result<Vec<SshContainerInfo>, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    let containeres = manager
        .list_containers(&connection_id)
        .await
        .map_err(|e| e.to_string());
    containeres
}

#[tauri::command]
async fn ssh_docker_start_container(
    state: State<'_, SshClientState>,
    connection_id: String,
    container_name: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .start_container(&connection_id, &container_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Container iniciado com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_stop_container(
    state: State<'_, SshClientState>,
    connection_id: String,
    container_name: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .stop_container(&connection_id, &container_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Container parado com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_pause_container(
    state: State<'_, SshClientState>,
    connection_id: String,
    container_name: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .pause_container(&connection_id, &container_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Container pausado com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_unpause_container(
    state: State<'_, SshClientState>,
    connection_id: String,
    container_name: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .unpause_container(&connection_id, &container_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Container despausado com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_remove_container(
    state: State<'_, SshClientState>,
    connection_id: String,
    container_name: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .remove_container(&connection_id, &container_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Container removido com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_restart_container(
    state: State<'_, SshClientState>,
    connection_id: String,
    container_name: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .restart_container(&connection_id, &container_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Container reiniciado com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_list_images(
    state: State<'_, SshClientState>,
    connection_id: String,
) -> Result<Vec<SshImageInfo>, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .list_images(&connection_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_docker_remove_image(
    state: State<'_, SshClientState>,
    connection_id: String,
    image_id: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .remove_image(&connection_id, &image_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Imagem removida com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_pull_image(
    state: State<'_, SshClientState>,
    connection_id: String,
    image_name: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .pull_image(&connection_id, &image_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Pull da imagem realizado com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_list_networks(
    state: State<'_, SshClientState>,
    connection_id: String,
) -> Result<Vec<SshNetworkInfo>, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .list_networks(&connection_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_docker_remove_network(
    state: State<'_, SshClientState>,
    connection_id: String,
    network_id: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .remove_network(&connection_id, &network_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Network removida com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_create_network(
    state: State<'_, SshClientState>,
    connection_id: String,
    network_name: String,
    driver: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .create_network(&connection_id, &network_name, &driver)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Network criada com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_list_volumes(
    state: State<'_, SshClientState>,
    connection_id: String,
) -> Result<Vec<SshVolumeInfo>, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .list_volumes(&connection_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_docker_remove_volume(
    state: State<'_, SshClientState>,
    connection_id: String,
    volume_name: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .remove_volume(&connection_id, &volume_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Volume removido com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_create_volume(
    state: State<'_, SshClientState>,
    connection_id: String,
    volume_name: String,
    driver: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .create_volume(&connection_id, &volume_name, &driver)
        .await
        .map_err(|e| e.to_string())?;
    Ok("Volume criado com sucesso".to_string())
}

#[tauri::command]
async fn ssh_docker_get_container_logs(
    state: State<'_, SshClientState>,
    connection_id: String,
    container_name: String,
    tail_lines: Option<String>,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .get_container_logs(&connection_id, &container_name, tail_lines)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_docker_create_container(
    state: State<'_, SshClientState>,
    connection_id: String,
    request: SshCreateContainerRequest,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    let container_id = manager
        .create_container(&connection_id, request)
        .await
        .map_err(|e| e.to_string())?;
    Ok(container_id)
}

#[tauri::command]
async fn ssh_docker_get_container_stats(
    state: State<'_, SshClientState>,
    connection_id: String,
    container_name: String,
) -> Result<String, String> {
    let ssh_client = state.lock().await;
    let manager = SshDockerManager::new(&*ssh_client);
    manager
        .get_container_stats(&connection_id, &container_name)
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SshClientState::new(SshClient::new()))
        .invoke_handler(tauri::generate_handler![
            ssh_test_connection,
            ssh_connect,
            ssh_disconnect,
            ssh_disconnect_all,
            ssh_list_connections,
            ssh_get_connection_info,
            ssh_is_connected,
            ssh_execute_command,
            ssh_cleanup_inactive_connections,
            ssh_get_saved_connections,
            ssh_add_saved_connection,
            ssh_remove_saved_connection,
            ssh_update_saved_connection_name,
            ssh_docker_status,
            ssh_docker_info,
            ssh_docker_system_usage,
            ssh_docker_list_containers,
            ssh_docker_start_container,
            ssh_docker_stop_container,
            ssh_docker_pause_container,
            ssh_docker_unpause_container,
            ssh_docker_remove_container,
            ssh_docker_restart_container,
            ssh_docker_list_images,
            ssh_docker_remove_image,
            ssh_docker_pull_image,
            ssh_docker_list_networks,
            ssh_docker_remove_network,
            ssh_docker_create_network,
            ssh_docker_list_volumes,
            ssh_docker_remove_volume,
            ssh_docker_create_volume,
            ssh_docker_get_container_logs,
            ssh_docker_create_container,
            ssh_docker_get_container_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
