# Docker.rs Removed

O arquivo docker.rs foi substituído pelo docker_ssh.rs e não é mais necessário.

## Mudanças feitas:
- Todos os comandos Docker locais foram substituídos por comandos SSH
- O aplicativo agora gerencia apenas contêineres de servidores via SSH
- A interface foi atualizada para remover opções de conexão local

## Arquivo a ser removido:
- `src-tauri/src/docker.rs` - pode ser removido manualmente

## Próximos passos:
- Testar funcionalidades com servidores SSH
- Verificar se todas as funcionalidades estão funcionando apenas via SSH