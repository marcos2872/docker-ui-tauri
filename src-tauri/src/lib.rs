use crate::docker::{DockerInfo, DockerManager, DockerSystemUsage};
use tokio::sync::Mutex;
use tauri::State;

mod docker;

// Global Docker Manager para manter cache entre chamadas
type DockerManagerState = Mutex<Option<DockerManager>>;

async fn get_docker_manager(state: &State<'_, DockerManagerState>) -> Result<DockerManager, String> {
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
async fn docker_system_usage(state: State<'_, DockerManagerState>) -> Result<DockerSystemUsage, String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DockerManagerState::default())
        .invoke_handler(tauri::generate_handler![
            docker_status,
            docker_infos,
            docker_system_usage
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
