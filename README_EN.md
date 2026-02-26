# Pet Hotel Desktop

Language: [RU](README.md) | [EN](README_EN.md)

<div align="center">

![Pet Hotel](https://img.shields.io/badge/Pet%20Hotel-Desktop-blue?style=for-the-badge&logo=electron)
![.NET](https://img.shields.io/badge/.NET-8.0-purple?style=for-the-badge&logo=dotnet)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite)
![Tests](https://img.shields.io/badge/Tests-CI%20Verified-success?style=for-the-badge&logo=checkmarx)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

[![Tests](https://github.com/t0nyhat/RentForPet_Desktop/actions/workflows/test.yml/badge.svg)](https://github.com/t0nyhat/RentForPet_Desktop/actions/workflows/test.yml)
[![Build and Release](https://github.com/t0nyhat/RentForPet_Desktop/actions/workflows/release.yml/badge.svg)](https://github.com/t0nyhat/RentForPet_Desktop/actions/workflows/release.yml)

**Local desktop app for pet hotel management**

[Features](#features) • [Quick Start](#quick-start) • [Build](#build-desktop-app) • [Development](#development) • [Testing](#testing) • [CI/CD](.github/CI_CD_SETUP.md)

</div>

---

## Overview

Pet Hotel Desktop is the **local desktop version of the RentForPet SaaS platform**. It works offline, stores all data on your computer, and does not require authentication. The dashboard opens immediately.

> 🌐 **Cloud SaaS version** with extended features will soon be available at [rentforpet.ru](https://rentforpet.ru)

### Highlights

- **Fully local** - works offline, data stays on your PC
- **No auth** - launch and work
- **Modern stack** - React + TypeScript + .NET 8
- **Cross-platform** - macOS, Windows, Linux

---

## Download

Ready-to-use builds for all platforms are available on the [GitHub Releases](https://github.com/t0nyhat/RentForPet_Desktop/releases) page.

| Platform | Link |
|----------|------|
| 🍎 macOS (Apple Silicon) | [RentForPet-1.0.5-arm64.dmg](https://github.com/t0nyhat/RentForPet_Desktop/releases/download/v1.0.5/RentForPet-1.0.5-arm64.dmg) |
| 🍎 macOS (Apple Silicon, ZIP) | [RentForPet-1.0.5-arm64.zip](https://github.com/t0nyhat/RentForPet_Desktop/releases/download/v1.0.5/RentForPet-1.0.5-arm64.zip) |
| 🍎 macOS (Intel) | [RentForPet-1.0.5-x64.zip](https://github.com/t0nyhat/RentForPet_Desktop/releases/download/v1.0.5/RentForPet-1.0.5-x64.zip) |
| 🐧 Linux (AppImage) | [RentForPet-1.0.5-x86_64.AppImage](https://github.com/t0nyhat/RentForPet_Desktop/releases/download/v1.0.5/RentForPet-1.0.5-x86_64.AppImage) |
| 🐧 Linux (Debian/Ubuntu) | [RentForPet-1.0.5-amd64.deb](https://github.com/t0nyhat/RentForPet_Desktop/releases/download/v1.0.5/RentForPet-1.0.5-amd64.deb) |

---

## Documentation

- RU: [docs/README.md](docs/README.md)
- EN: [docs/README_EN.md](docs/README_EN.md)
- In app: `Help` section (`/help`)

---

## Features

### Booking management
- Create and edit bookings
- Room occupancy Gantt chart
- Combined bookings with room moves
- Automatic price calculation
- Discounts and prepayment system
- Statuses: Pending -> Confirmed -> Checked in -> Checked out

### Clients and pets
- Client database with booking history
- Pet profiles with notes
- Pet activity journal
- Loyalty system with discounts

### Rooms
- Room types with descriptions and prices
- Individual room management
- Availability checks

### Payments
- Multiple payment methods (card, cash, bank transfer)
- Refunds and payment transfers between bookings
- Payment status tracking

---

## Screenshots

<div align="center">

### Booking Schedule (Gantt Chart)
![Schedule](docs/assets/en/02-schedule.png)

### All Bookings Table
![Bookings](docs/assets/en/03-bookings-table.png)

### Create New Booking
![Create Booking](docs/assets/en/04-manual-booking.png)

### Client Management
![Clients](docs/assets/en/07-clients.png)

### Room Management
![Rooms](docs/assets/en/09-rooms.png)

</div>

---

## Technologies

| Layer | Technologies |
|------|-----------|
| **Desktop** | Electron |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Query |
| **Backend** | .NET 8, ASP.NET Core Web API |
| **Database** | SQLite (local, created automatically) |

---

## Quick Start

### Requirements

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/)

### Install

```bash
# Clone repository
git clone https://github.com/t0nyhat/RentForPet_Desktop.git
cd RentForPet_Desktop

# Install dependencies
npm install
cd frontend && npm install && cd ..
```

### Run

```bash
npm run dev
```

It will open:
- Backend: `http://localhost:5226`
- Frontend: `http://localhost:5173`

> The SQLite database is created automatically on first run in `data/`.

### Export and backup

- In `Schedule`, there is an `Export to Excel` button (an `.xlsx` file) with all booking data.
- The `DB Backup` button creates a SQLite backup and downloads the file.
- The server also saves backups in `data/backups/` next to `pethotel.db`.

---

## Build Desktop App

### Automated build (CI/CD)

On PR merge into `main`:
- Auto Version Bump increases the version and creates tag `vX.Y.Z`
- Build and Release (workflow_run) runs tests
- Builds are created for all platforms (Windows, macOS ARM, Linux)
- A GitHub release is published

More details: [CI/CD Setup](.github/CI_CD_SETUP.md)

### Local build

```bash
# macOS (Apple Silicon)
npm run build:mac-silicon

# macOS (Intel)
npm run build:mac-intel

# Windows
npm run build:win

# Linux
npm run build:linux
```

The app will appear in `dist-electron/`.

Icons are taken from `build/icons/` (`icon.icns` for macOS, `icon.ico` for Windows). Automatic generation during build is not performed.

---

## Project Structure

```
petshoteldesktop/
├── frontend/                 # React + TypeScript
│   └── src/
│       ├── components/       # UI components
│       ├── pages/            # Pages
│       └── context/          # React contexts
├── PetHotel.API/             # ASP.NET Core Web API
│   └── Controllers/          # API endpoints
├── PetHotel.Application/     # Business logic
│   ├── DTOs/                 # Data Transfer Objects
│   └── Services/             # Services
├── PetHotel.Domain/          # Entities and interfaces
├── PetHotel.Infrastructure/  # Data access
│   └── Data/                 # EF Core DbContext
├── PetHotel.Tests/           # Backend tests (xUnit)
├── main.js                   # Electron
└── data/                     # SQLite database
```

---

## Development

### Commands

```bash
# Run in development mode
npm run dev

# Frontend only
npm run dev:react

# Backend only
npm run dev:dotnet

# Builds
npm run build:mac-silicon   # macOS Apple Silicon
npm run build:mac-intel     # macOS Intel
npm run build:win           # Windows
```

### Frontend

```bash
cd frontend
npm run dev          # Dev server
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript check
npm test             # Run tests
```

### Backend

```bash
dotnet run --project PetHotel.API              # Run
dotnet watch run --project PetHotel.API        # Hot reload
dotnet build PetHotel.sln                      # Build
dotnet test PetHotel.Tests                     # Run tests
```

---

## License

MIT License — see [LICENSE](LICENSE)

---

## Built with AI

This product was developed exclusively using artificial intelligence tools:

![AI Tools](https://img.shields.io/badge/Built%20with-AI-blueviolet?style=for-the-badge)

- **GitHub Copilot** — AI assistant directly in the editor
- **Claude (Anthropic)** — code generation and analysis
- **OpenAI Codex** — code completion and writing
- **Cursor** — AI code editor
- **Sourcecraft** — AI-powered development tools

---

<div align="center">

**RentForPet** 🐾

</div>

<!-- Updated: 2026-02-26 -->
