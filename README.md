# Docker Tauri

A desktop Docker management application built with Tauri, React, and TypeScript.

## Overview

Docker Tauri provides a modern desktop interface for managing Docker containers, images, networks, and volumes. The application combines the security and performance of Rust with the flexibility of a React frontend to deliver a seamless Docker management experience.

## Features

- **Container Management**: View, start, stop, and monitor Docker containers
- **Image Management**: List and manage Docker images
- **Network Management**: View and manage Docker networks
- **Volume Management**: Handle Docker volumes
- **Real-time Monitoring**: Live container statistics and performance metrics
- **Cross-platform**: Available for Windows, macOS, and Linux

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Vite** - Build tool

### Backend
- **Rust** - Core application logic
- **Tauri** - Desktop application framework
- **Bollard** - Docker API client
- **Tokio** - Async runtime
- **Serde** - Serialization

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [pnpm](https://pnpm.io/) package manager
- [Rust](https://rustup.rs/) (latest stable)
- [Docker](https://www.docker.com/) installed and running

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd docker-tauri
   ```

2. Install frontend dependencies:
   ```bash
   pnpm install
   ```

3. Install Tauri CLI:
   ```bash
   cargo install tauri-cli
   ```

## Development

To start the development server:

```bash
pnpm run tauri dev
```

This will start both the React development server and the Tauri application.

## Building

To build the application for production:

```bash
pnpm run tauri build
```

The built application will be available in the `src-tauri/target/release/bundle/` directory.

## Scripts

- `pnpm dev` - Start Vite development server
- `pnpm build` - Build the React application
- `pnpm preview` - Preview the built application
- `pnpm tauri dev` - Start Tauri development mode
- `pnpm tauri build` - Build the Tauri application

## Project Structure

```
docker-tauri/
├── src/                    # React frontend
│   ├── components/         # React components
│   │   ├── dashboard/      # Main dashboard
│   │   ├── header/         # Application header
│   │   └── LineChart/      # Chart component
│   ├── App.tsx            # Main App component
│   └── main.tsx           # Entry point
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── docker.rs      # Docker API integration
│   │   ├── lib.rs         # Library entry point
│   │   └── main.rs        # Application entry point
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── public/                # Static assets
└── package.json           # Node.js dependencies
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and ensure code quality
5. Submit a pull request

## License

This project is open source. Please check the license file for more details.

## Docker Requirements

Make sure Docker is installed and the Docker daemon is running on your system before using this application.