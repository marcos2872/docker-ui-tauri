# Docker Tauri

A desktop Docker management application built with Tauri, React, and TypeScript.

## Overview

Docker Tauri provides a modern desktop interface for managing Docker containers, images, networks, and volumes. The application combines the security and performance of Rust with the flexibility of a React frontend to deliver a seamless Docker management experience.

## Features

- **Container Management**: View, start, stop, and monitor Docker containers
- **Image Management**: List and manage Docker images
- **Network Management**: View and manage Docker networks
- **Volume Management**: Handle Docker volumes
- **Real-time Dashboard**: Live system statistics and performance metrics
- **Advanced Monitoring Charts**:
  - **CPU Usage**: Real-time CPU percentage with dynamic scaling based on available cores
  - **Memory Usage**: RAM consumption in MB/GB with intelligent unit conversion
  - **Network Traffic**: Dual-line charts showing RX/TX separately with auto-scaling units (KB/MB/GB)
- **Dynamic Scaling**: All charts automatically adjust their scales based on historical data
- **Cross-platform**: Available for Windows, macOS, and Linux

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **@tailwindcss/vite** - Tailwind CSS integration with Vite
- **React Google Charts** - Real-time data visualization and monitoring charts
- **React Icons** - A collection of popular icons
- **@tauri-apps/api** - Tauri API for interacting with the backend
- **@tauri-apps/plugin-opener** - Tauri plugin for opening links in the default browser
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

- `pnpm run dev` - Start Vite development server
- `pnpm run build` - Build the React application
- `pnpm run preview` - Preview the built application
- `pnpm run tauri dev` - Start Tauri development mode
- `pnpm run tauri build` - Build the Tauri application

## Project Structure

```
docker-tauri/
├── src/
│   ├── components/
│   │   ├── CreateContainerModal/
│   │   ├── Header/
│   │   ├── LineChart/
│   │   ├── MultiLineChart/
│   │   ├── NavBar/
│   │   └── Toast/
│   ├── contexts/
│   │   └── MonitoringContext.tsx
│   ├── screens/
│   │   ├── Containers/
│   │   ├── Dashboard/
│   │   ├── Images/
│   │   ├── Networks/
│   │   ├── Servers/
│   │   └── Volumes/
│   ├── App.css
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── src-tauri/
│   ├── src/
│   │   ├── docker.rs
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── capabilities/
│   ├── gen/
│   ├── icons/
│   ├── .gitignore
│   ├── build.rs
│   ├── Cargo.lock
│   ├── Cargo.toml
│   └── tauri.conf.json
├── public/
│   ├── tauri.svg
│   └── vite.svg
├── .gitignore
├── index.html
├── package.json
├── pnpm-lock.yaml
├── README.md
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Features Details

### Real-time Monitoring Dashboard

The application provides comprehensive real-time monitoring with:

#### CPU Monitoring
- Real-time CPU usage percentage
- Dynamic scaling based on CPU core count (never exceeds cores × 100%)
- Historical data with 60-point rolling window
- Automatic 10% headroom above peak usage for better visualization

#### Memory Monitoring
- RAM usage displayed in absolute values (MB/GB)
- Intelligent unit conversion (MB for smaller values, GB for larger)
- Percentage calculation with total system memory
- Dynamic scaling based on system memory limits

#### Network Monitoring
- Dual-line visualization for RX (receive) and TX (transmit)
- Automatic unit scaling (KB/MB/GB) based on traffic volume
- Color-coded lines: Green for RX, Orange for TX
- Real-time total, RX, and TX values in chart title

### Chart Features
- **Auto-scaling Y-axis**: All charts automatically adjust their maximum values
- **45° rotated time labels**: Prevents overlap of time stamps
- **Dark theme**: Optimized for Docker desktop environments
- **Responsive design**: Charts adapt to window size changes
- **Historical tracking**: 60 seconds of historical data retained

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
