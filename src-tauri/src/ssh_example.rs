use crate::client_ssh::{SavedSshConnection, SshClient, SshConnectionRequest};

pub async fn example_usage() -> Result<(), String> {
    // Criar uma instância do cliente SSH
    let ssh_client = SshClient::new();

    println!("=== Exemplo de uso das conexões SSH persistidas ===\n");

    // 1. Listar conexões salvas (se houver)
    println!("1. Conexões salvas:");
    let saved_connections = ssh_client.get_saved_connections().await;
    if saved_connections.is_empty() {
        println!("   Nenhuma conexão salva encontrada.\n");
    } else {
        for conn in &saved_connections {
            let name = conn.name.as_deref().unwrap_or("Sem nome");
            println!(
                "   - {} ({}@{}:{})",
                name, conn.username, conn.host, conn.port
            );
        }
        println!();
    }

    // 2. Exemplo de nova conexão (será automaticamente salva)
    println!("2. Conectando a um servidor SSH...");
    let connection_request = SshConnectionRequest {
        host: "exemplo.com".to_string(),
        port: 22,
        username: "usuario".to_string(),
        password: "senha123".to_string(), // Esta senha NÃO será salva
    };

    // Testar a conexão primeiro
    match ssh_client.test_connection(&connection_request).await {
        Ok(message) => {
            println!("   Teste de conexão: {}", message);

            // Se o teste passou, conectar de verdade
            match ssh_client.connect(connection_request.clone()).await {
                Ok(connection_id) => {
                    println!("   Conectado com ID: {}", connection_id);

                    // Executar um comando
                    match ssh_client.execute_command(&connection_id, "uname -a").await {
                        Ok(output) => println!("   Saída do comando: {}", output.trim()),
                        Err(e) => println!("   Erro ao executar comando: {}", e),
                    }

                    // Desconectar
                    match ssh_client.disconnect(&connection_id).await {
                        Ok(message) => println!("   {}", message),
                        Err(e) => println!("   Erro ao desconectar: {}", e),
                    }
                }
                Err(e) => println!("   Erro na conexão: {}", e),
            }
        }
        Err(e) => println!("   Erro no teste: {}", e),
    }

    // 3. Adicionar uma conexão salva manualmente
    println!("\n3. Adicionando uma conexão salva manualmente...");
    let manual_connection = SavedSshConnection {
        host: "servidor.empresa.com".to_string(),
        port: 2222,
        username: "admin".to_string(),
        name: Some("Servidor da Empresa".to_string()),
    };

    match ssh_client.add_saved_connection(manual_connection).await {
        Ok(_) => println!("   Conexão adicionada com sucesso!"),
        Err(e) => println!("   Erro ao adicionar conexão: {}", e),
    }

    // 4. Atualizar o nome de uma conexão salva
    println!("\n4. Atualizando nome da primeira conexão...");
    match ssh_client
        .update_saved_connection_name(
            "exemplo.com",
            22,
            "usuario",
            Some("Servidor de Exemplo".to_string()),
        )
        .await
    {
        Ok(_) => println!("   Nome atualizado com sucesso!"),
        Err(e) => println!("   Erro ao atualizar nome: {}", e),
    }

    // 5. Listar conexões salvas novamente
    println!("\n5. Conexões salvas após as modificações:");
    let updated_connections = ssh_client.get_saved_connections().await;
    for conn in &updated_connections {
        let name = conn.name.as_deref().unwrap_or("Sem nome");
        println!(
            "   - {} ({}@{}:{})",
            name, conn.username, conn.host, conn.port
        );
    }

    // 6. Exemplo de remoção de conexão salva
    println!("\n6. Removendo uma conexão salva...");
    match ssh_client
        .remove_saved_connection("exemplo.com", 22, "usuario")
        .await
    {
        Ok(_) => println!("   Conexão removida com sucesso!"),
        Err(e) => println!("   Erro ao remover conexão: {}", e),
    }

    // 7. Verificar conexões ativas
    println!("\n7. Conexões ativas:");
    match ssh_client.list_connections().await {
        Ok(active_connections) => {
            if active_connections.is_empty() {
                println!("   Nenhuma conexão ativa.");
            } else {
                for conn in active_connections {
                    println!(
                        "   - ID: {} ({}@{}:{})",
                        conn.connection_id, conn.username, conn.host, conn.port
                    );
                }
            }
        }
        Err(e) => println!("   Erro ao listar conexões: {}", e),
    }

    println!("\n=== Fim do exemplo ===");
    Ok(())
}

// Função para simular um fluxo de reconexão usando conexões salvas
pub async fn reconnect_flow_example() -> Result<(), String> {
    println!("\n=== Exemplo de fluxo de reconexão ===");

    let ssh_client = SshClient::new();

    // Listar conexões salvas
    let saved_connections = ssh_client.get_saved_connections().await;

    if saved_connections.is_empty() {
        println!("Nenhuma conexão salva disponível para reconexão.");
        return Ok(());
    }

    println!("Conexões disponíveis para reconexão:");
    for (index, conn) in saved_connections.iter().enumerate() {
        let name = conn.name.as_deref().unwrap_or("Sem nome");
        println!(
            "{}. {} ({}@{}:{})",
            index + 1,
            name,
            conn.username,
            conn.host,
            conn.port
        );
    }

    // Simular seleção da primeira conexão
    if let Some(selected_conn) = saved_connections.first() {
        println!(
            "\nReconectando à: {}@{}:{}",
            selected_conn.username, selected_conn.host, selected_conn.port
        );

        // O usuário forneceria a senha aqui
        let reconnect_request = SshConnectionRequest {
            host: selected_conn.host.clone(),
            port: selected_conn.port,
            username: selected_conn.username.clone(),
            password: "senha_do_usuario".to_string(), // Senha fornecida pelo usuário
        };

        // Tentar reconectar
        match ssh_client.test_connection(&reconnect_request).await {
            Ok(_) => println!("Reconexão bem-sucedida!"),
            Err(e) => println!("Falha na reconexão: {}", e),
        }
    }

    Ok(())
}
