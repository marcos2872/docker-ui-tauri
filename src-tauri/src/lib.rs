use crate::docker::{
    ContainerInfo, CreateContainerRequest, DockerInfo, DockerManager, DockerSystemUsage, ImageInfo,
    NetworkInfo, VolumeInfo,
};

use tauri::State;
use tokio::sync::Mutex;

mod docker;

// Global Docker Manager para manter cache entre chamadas
type DockerManagerState = Mutex<Option<DockerManager>>;

async fn get_docker_manager(
    state: &State<'_, DockerManagerState>,
) -> Result<DockerManager, String> {
    let mut manager_guard = state.lock().await;

    if manager_guard.is_none() {
        match DockerManager::new().await {
            Ok(manager) => *manager_guard = Some(manager),
            Err(e) => return Err(e.to_string()),
        }
    }

    Ok(manager_guard.take().unwrap())
}

async fn set_docker_manager(state: &State<'_, DockerManagerState>, manager: DockerManager) {
    let mut manager_guard = state.lock().await;
    *manager_guard = Some(manager);
}

#[tauri::command]
async fn docker_status(state: State<'_, DockerManagerState>) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    let status = manager.check_docker_status().to_string();
    set_docker_manager(&state, manager).await;
    Ok(status)
}

#[tauri::command]
async fn docker_infos(state: State<'_, DockerManagerState>) -> Result<DockerInfo, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.get_docker_info().await {
        Ok(infos) => {
            set_docker_manager(&state, manager).await;
            Ok(infos)
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_system_usage(
    state: State<'_, DockerManagerState>,
) -> Result<DockerSystemUsage, String> {
    let mut manager = get_docker_manager(&state).await?;
    match manager.get_docker_system_usage().await {
        Ok(infos) => {
            set_docker_manager(&state, manager).await;
            Ok(infos)
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_list_containers(
    state: State<'_, DockerManagerState>,
) -> Result<Vec<ContainerInfo>, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.list_containers().await {
        Ok(containers) => {
            set_docker_manager(&state, manager).await;
            Ok(containers)
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_get_container(
    state: State<'_, DockerManagerState>,
    container_id: String,
) -> Result<ContainerInfo, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.get_container(&container_id).await {
        Ok(container) => {
            set_docker_manager(&state, manager).await;
            Ok(container)
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_get_container_logs(
    state: State<'_, DockerManagerState>,
    container_id: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager
        .get_container_logs(&container_id, Some("100".to_string()))
        .await
    {
        Ok(logs) => {
            set_docker_manager(&state, manager).await;
            Ok(logs)
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_start_container(
    state: State<'_, DockerManagerState>,
    container_id: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.start_container(&container_id).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Container started successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_stop_container(
    state: State<'_, DockerManagerState>,
    container_id: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.stop_container(&container_id).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Container stopped successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_pause_container(
    state: State<'_, DockerManagerState>,
    container_id: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.pause_container(&container_id).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Container paused successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_unpause_container(
    state: State<'_, DockerManagerState>,
    container_id: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.unpause_container(&container_id).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Container unpaused successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_restart_container(
    state: State<'_, DockerManagerState>,
    container_id: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.restart_container(&container_id).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Container restarted successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_remove_container(
    state: State<'_, DockerManagerState>,
    container_id: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.remove_container(&container_id).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Container removed successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_create_container(
    state: State<'_, DockerManagerState>,
    request: CreateContainerRequest,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.create_container(request).await {
        Ok(container_id) => {
            set_docker_manager(&state, manager).await;
            Ok(container_id)
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_list_images(
    state: State<'_, DockerManagerState>,
) -> Result<Vec<ImageInfo>, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.list_images().await {
        Ok(images) => {
            set_docker_manager(&state, manager).await;
            Ok(images)
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_remove_image(
    state: State<'_, DockerManagerState>,
    image_id: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.remove_image(&image_id).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Image removed successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_pull_image(
    state: State<'_, DockerManagerState>,
    image_name: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.pull_image(&image_name).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Image pulled successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_list_volumes(
    state: State<'_, DockerManagerState>,
) -> Result<Vec<VolumeInfo>, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.list_volumes().await {
        Ok(volumes) => {
            set_docker_manager(&state, manager).await;
            Ok(volumes)
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_remove_volume(
    state: State<'_, DockerManagerState>,
    volume_name: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.remove_volume(&volume_name).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Volume removed successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_create_volume(
    state: State<'_, DockerManagerState>,
    volume_name: String,
    driver: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.create_volume(&volume_name, &driver).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Volume created successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_list_networks(
    state: State<'_, DockerManagerState>,
) -> Result<Vec<NetworkInfo>, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.list_networks().await {
        Ok(networks) => {
            set_docker_manager(&state, manager).await;
            Ok(networks)
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_remove_network(
    state: State<'_, DockerManagerState>,
    network_id: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.remove_network(&network_id).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Network removed successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn docker_create_network(
    state: State<'_, DockerManagerState>,
    network_name: String,
    driver: String,
) -> Result<String, String> {
    let manager = get_docker_manager(&state).await?;
    match manager.create_network(&network_name, &driver).await {
        Ok(_) => {
            set_docker_manager(&state, manager).await;
            Ok("Network created successfully".to_string())
        }
        Err(e) => {
            set_docker_manager(&state, manager).await;
            Err(e.to_string())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DockerManagerState::default())
        .invoke_handler(tauri::generate_handler![
            docker_status,
            docker_infos,
            docker_system_usage,
            docker_list_containers,
            docker_get_container,
            docker_get_container_logs,
            docker_start_container,
            docker_stop_container,
            docker_pause_container,
            docker_unpause_container,
            docker_restart_container,
            docker_remove_container,
            docker_create_container,
            docker_list_images,
            docker_remove_image,
            docker_pull_image,
            docker_list_volumes,
            docker_remove_volume,
            docker_create_volume,
            docker_list_networks,
            docker_remove_network,
            docker_create_network,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
