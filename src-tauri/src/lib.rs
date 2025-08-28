use crate::docker::{DockerInfo, DockerManager, DockerStatus, DockerSystemUsage};

mod docker;

#[tauri::command]
async fn docker_status() -> String {
    match DockerManager::new().await {
        Ok(docker) => docker.check_docker_status().to_string(),
        Err(_) => DockerStatus::NotInstalled.to_string(),
    }
}

#[tauri::command]
async fn docker_infos() -> Result<DockerInfo, String> {
    match DockerManager::new().await {
        Ok(docker) => match docker.get_docker_info().await {
            Ok(infos) => Ok(infos),
            Err(e) => Err(e.to_string()),
        },
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn docker_system_usage() -> Result<DockerSystemUsage, String> {
    match DockerManager::new().await {
        Ok(mut docker) => match docker.get_docker_system_usage().await {
            Ok(infos) => Ok(infos),
            Err(e) => Err(e.to_string()),
        },
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            docker_status,
            docker_infos,
            docker_system_usage
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
