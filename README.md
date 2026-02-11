# Faceless

Private, friends-only voice & text chat. A self-hosted Discord alternative built with Electron, React, and LiveKit.

## Features

- **Text Chat** - Servers, channels, real-time messaging with typing indicators
- **Voice Chat** - Low-latency channel-based voice via LiveKit SFU
- **Invite-Only** - No phone, no email, just a username and password
- **Presence** - See who's online and who's in voice
- **LAN Friendly** - Configurable server URL for local network use

## Architecture

Monorepo with three packages:

| Package | Description |
|---------|-------------|
| `packages/shared` | TypeScript types and WebSocket event contracts |
| `packages/server` | Express API, SQLite database, WebSocket handler, LiveKit voice integration |
| `packages/client` | Electron + React + Tailwind desktop app |

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [pnpm](https://pnpm.io/) 8 or later
- [Docker](https://www.docker.com/) (for LiveKit voice server)

---

## Server Setup

### Windows

1. **Install Node.js** - Download and install from [nodejs.org](https://nodejs.org/) (LTS recommended)

2. **Install pnpm**
   ```powershell
   npm install -g pnpm
   ```

3. **Install Docker Desktop** - Download from [docker.com](https://www.docker.com/products/docker-desktop/) and make sure it's running

4. **Clone the repo**
   ```powershell
   git clone https://github.com/joshakins/faceless.git
   cd faceless
   ```

5. **Install dependencies**
   ```powershell
   pnpm install
   ```

6. **Start LiveKit** (voice server)
   ```powershell
   docker compose up -d
   ```

7. **Build shared types**
   ```powershell
   pnpm run build:shared
   ```

8. **Start the server**
   ```powershell
   pnpm run dev:server
   ```

   The API server will be running on `http://0.0.0.0:3000`.

### Linux (Ubuntu/Debian)

1. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Install pnpm**
   ```bash
   npm install -g pnpm
   ```

3. **Install Docker**
   ```bash
   # Install Docker Engine
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # Log out and back in for group change to take effect, then:
   sudo systemctl start docker
   ```

4. **Clone the repo**
   ```bash
   git clone https://github.com/joshakins/faceless.git
   cd faceless
   ```

5. **Install dependencies**
   ```bash
   pnpm install
   ```

6. **Start LiveKit** (voice server)
   ```bash
   docker compose up -d
   ```

7. **Build shared types**
   ```bash
   pnpm run build:shared
   ```

8. **Start the server**
   ```bash
   pnpm run dev:server
   ```

   The API server will be running on `http://0.0.0.0:3000`.

### Environment Variables (Optional)

Copy the example env file if you want to customize settings:

```bash
cp packages/server/.env.example packages/server/.env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `DB_PATH` | `./data/faceless.db` | SQLite database file path |
| `LIVEKIT_URL` | `ws://localhost:7880` | LiveKit server WebSocket URL |
| `LIVEKIT_API_KEY` | `devkey` | LiveKit API key (must match livekit.yaml) |
| `LIVEKIT_API_SECRET` | `devsecretdevsecretdevsecret12345` | LiveKit API secret (must match livekit.yaml) |

### Firewall (LAN Access)

If other users on your network need to connect, open these ports:

| Port | Protocol | Service |
|------|----------|---------|
| `3000` | TCP | Faceless API + WebSocket |
| `7880` | TCP | LiveKit HTTP/WebSocket |
| `7881` | TCP | LiveKit RTC (TCP) |
| `7882` | UDP | LiveKit RTC (UDP) |

---

## Client Setup

### Run from Source

```bash
pnpm run dev:client
```

### Download a Release

Pre-built binaries are available on the [Releases](https://github.com/joshakins/faceless/releases) page:

- **Windows**: `Faceless-x.x.x-portable.exe` - Just download and run
- **Linux**: `Faceless-x.x.x.AppImage` - Download, `chmod +x`, and run

### Build Installers Yourself

**Windows** (from Windows):
```bash
pnpm --filter @faceless/client dist
```

**Linux** (from a Linux machine or WSL):
```bash
pnpm --filter @faceless/client dist:linux
```

### Connecting to a Server

When you launch the client, you'll see a **Server address** field on the login screen. Enter the IP and port of whoever is hosting the server (e.g. `192.168.1.50:3000`). It defaults to `localhost:3000`.

---

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Zustand, electron-vite
- **Backend**: Express, SQLite (better-sqlite3), WebSocket (ws)
- **Voice**: LiveKit SFU (self-hosted via Docker)
- **Auth**: Argon2 password hashing, HTTP-only session cookies
- **Desktop**: Electron
