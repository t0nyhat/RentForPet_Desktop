# Development Guide

Complete guide for setting up and developing Pet Hotel Desktop locally.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Development Setup](#development-setup)
4. [Running Locally](#running-locally)
5. [Architecture](#architecture)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Testing](#testing)
9. [Debugging](#debugging)
10. [Building for Production](#building-for-production)

## Prerequisites

- **Node.js 18+** (download from [nodejs.org](https://nodejs.org/))
- **.NET 8 SDK** (download from [dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/8.0))
- **Git** for version control
- **macOS users**: Xcode Command Line Tools for native module compilation

### Install Xcode Command Line Tools (macOS)

```bash
xcode-select --install
```

## Project Structure

```
PetForRentDesktop/
├── frontend/                 # React TypeScript UI
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   │   ├── Modal.tsx
│   │   │   ├── AlertModal.tsx
│   │   │   └── ...
│   │   ├── pages/           # Application pages
│   │   │   ├── Bookings.tsx
│   │   │   ├── Clients.tsx
│   │   │   └── ...
│   │   ├── context/         # React Context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── utils/           # Utility functions
│   │   ├── i18n/            # Internationalization
│   │   └── types/           # TypeScript type definitions
│   ├── test/                # Frontend tests (Vitest)
│   ├── vite.config.ts       # Vite configuration
│   └── package.json
│
├── PetHotel.API/            # ASP.NET Core Web API
│   ├── Controllers/         # API controllers
│   │   ├── BookingsController.cs
│   │   ├── ClientsController.cs
│   │   └── ...
│   ├── Services/            # Business logic services
│   ├── Models/              # Data models/DTOs
│   ├── Middleware/          # Custom middleware
│   ├── Program.cs           # Startup configuration
│   └── appsettings.json     # API configuration
│
├── PetHotel.Application/    # Application layer
│   ├── DTOs/                # Data Transfer Objects
│   ├── Services/            # Application services
│   └── Validators/          # Input validators
│
├── PetHotel.Domain/         # Domain layer
│   ├── Entities/            # Business entities
│   ├── Enums/               # Enumerations
│   └── Interfaces/          # Contracts
│
├── PetHotel.Infrastructure/ # Infrastructure layer
│   ├── Data/                # EF Core DbContext
│   ├── Repositories/        # Data access patterns
│   └── Services/            # Infrastructure services
│
├── PetHotel.Tests/          # Backend unit tests (xUnit)
│
├── main.js                  # Electron main process
├── preload.js               # Electron preload script
│
├── docs/                    # Documentation
│   ├── ru/                  # Russian docs
│   └── en/                  # English docs
│
└── .github/workflows/       # CI/CD pipelines
    ├── test.yml
    ├── auto-version.yml
    └── release.yml
```

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/t0nyhat/PetForRentDesktop.git
cd PetForRentDesktop
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Restore .NET dependencies
dotnet restore
```

### 3. Configure Databases

The application uses SQLite. Database is created automatically on first run:

```bash
# macOS development path
~/.local/share/PetHotel/data/pethotel.db

# Windows development path
%LocalAppData%\PetHotel\data\pethotel.db
```

## Running Locally

### Option 1: Full Stack (Recommended for Development)

Run both frontend (Vite) and API together:

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173 (Vite with HMR)
- **API**: http://localhost:5226 (ASP.NET Core)
- **Database**: Created automatically in `~/.local/share/PetHotel/data/` (macOS)

### Option 2: Separate Terminals

Terminal 1 - Frontend + API:
```bash
npm run dev
```

Terminal 2 - Electron (after API is ready):
```bash
npm start
```

The Electron window will open with DevTools automatically enabled.

### Option 3: Without Electron (Web Only)

For web-only development without Electron:

```bash
npm run dev
```

Then open http://localhost:5173 in your browser.

### Option 4: API Debugging from IDE

If you want to debug the API with breakpoints:

1. Open the solution in Visual Studio, Rider, or VS Code
2. Set **PetHotel.API** as startup project
3. Press F5 to start debugging
4. Run frontend separately: `npm run dev:react`

## Architecture

### Layered Architecture

The backend follows a clean layered architecture:

```
Presentation Layer (Controllers)
    ↓
Application Layer (Services, DTOs, Validators)
    ↓
Domain Layer (Entities, Business Logic)
    ↓
Infrastructure Layer (Data Access, EF Core)
```

### Frontend Architecture

- **Components**: Reusable UI components (Modal, AlertModal, etc.)
- **Pages**: Full-page components (Bookings, Clients, etc.)
- **Context**: Global state (React Context)
- **Hooks**: Custom hooks for shared logic
- **Utils**: Helper functions (formatting, calculations)

## Database Schema

Key entities:

- **Bookings**: Reservation records with status tracking
- **Rooms**: Hotel rooms with types
- **RoomTypes**: Room categories with pricing
- **Clients**: Customer information
- **Pets**: Pet profiles linked to clients
- **Payments**: Payment records for bookings
- **Services**: Additional services (grooming, training, etc.)

### Seeding Data

On first run with `Seed.Enabled: true` in `appsettings.json`:
- Creates 3 room types (Standard, Deluxe, Suite)
- Creates 6 sample rooms
- Creates 1 test client with 2 test pets
- Creates 1 sample booking

## API Endpoints

Main endpoints (all responses are JSON):

```
GET    /api/bookings           - List bookings
POST   /api/bookings           - Create booking
GET    /api/bookings/{id}      - Get booking details
PUT    /api/bookings/{id}      - Update booking
DELETE /api/bookings/{id}      - Cancel booking

GET    /api/rooms              - List rooms
GET    /api/roomtypes          - List room types

GET    /api/clients            - List clients
POST   /api/clients            - Create client
GET    /api/clients/{id}       - Get client details

GET    /api/pets               - List pets
POST   /api/pets               - Create pet

GET    /api/payments           - List payments
POST   /api/payments           - Create payment

GET    /health                 - Health check
```

For full API documentation, see `PetHotel.API/PetHotel.API.http` (REST Client format).

## Testing

### Frontend Tests (Vitest)

```bash
cd frontend

# Run tests in watch mode
npm test

# Run all tests once
npm run test:run

# Generate coverage report
npm run test:coverage

# UI for tests
npm run test:ui
```

Test files: `frontend/src/**/*.test.ts(x)`

### Backend Tests (xUnit)

```bash
# Run all tests
dotnet test

# Run specific test class
dotnet test --filter ClassName

# With coverage
dotnet test /p:CollectCoverageRunSettings=true

# Verbose output
dotnet test --verbosity normal
```

Test files: `PetHotel.Tests/`

### Pre-commit Hooks

Husky runs automatic checks:

```bash
# Automatically runs on git commit:
# - Frontend: ESLint, type-check, tests
# - Backend: StyleCop, build, tests

# Skip checks if necessary (not recommended):
git commit --no-verify
```

## Debugging

### Frontend Debugging

DevTools opens automatically in development mode:

```bash
npm run dev
# DevTools appears in the Electron window (Inspector)
# Or use Chrome: http://localhost:5173 → F12
```

### Backend Debugging

#### In IDE (Recommended)

1. Set breakpoint in C# code
2. Press F5 to start debugging
3. IDE will pause at breakpoints

#### In Terminal

Use ASPNETCORE loggers:

```bash
ASPNETCORE_ENVIRONMENT=Development npm run dev:dotnet
# Check logs: see write-up below
```

### Checking Logs

**macOS/Linux**:
```bash
cat ~/Library/Application\ Support/Pet\ Hotel/api.log    # Packaged app
tail -f /tmp/pethotel-desktop.log                         # Dev mode
```

**Windows**:
```powershell
Get-Content "$env:LOCALAPPDATA\Pet Hotel\api.log"
```

## Building for Production

### Local Build

Choose your platform:

```bash
# macOS Apple Silicon (M1/M2/M3)
npm run build:mac-silicon

# macOS Intel
npm run build:mac-intel

# Windows
npm run build:win

# Linux
npm run build:linux
```

Output: `dist-electron/` folder with:
- macOS: `.dmg` installer and `.zip`
- Windows: `.exe` installer and `.zip`
- Linux: `.AppImage` and `.deb`

### GitHub Actions (Automatic)

When you merge a PR to `main`:

1. **Auto Version Bump** workflow raises version
2. **Build and Release** workflow:
   - Runs all tests
   - Builds for all platforms
   - Creates GitHub Release
   - Publishes artifacts

### Release Process

For a new stable release:

1. Update version in `package.json` (e.g., `1.0.3`)
2. Create PR and merge to `main`
3. Auto Version Bump creates tag `v1.0.3`
4. Build and Release publishes the release

See [VERSIONING.md](docs/VERSIONING.md) for details.

## Common Issues

### "PetHotel.API/out is empty"

The backend wasn't properly compiled. Run:

```bash
npm run build:mac-silicon  # or appropriate platform
```

### Database locked error

SQLite is locked. Solutions:
1. Close all instances of the app
2. Delete `~/Library/Application Support/Pet Hotel/data/pethotel.db` and restart
3. Check for zombie processes: `lsof | grep pethotel`

### Port 5226 already in use

Another process is using the API port:

```bash
# macOS/Linux: Find process
lsof -i :5226

# Windows: Find process
netstat -ano | findstr :5226

# Kill it or use different port
export ASPNETCORE_URLS=http://localhost:5227
```

### Vite HMR Issues

If hot reload isn't working:

```bash
rm -rf node_modules frontend/node_modules
npm install && cd frontend && npm install && cd ..
npm run dev
```

## Tips for Contributors

1. **Before starting work**, read [CONTRIBUTING.md](CONTRIBUTING.md)
2. **Use meaningful commit messages** (Conventional Commits)
3. **Write tests** for new features
4. **Keep PRs focused** - one feature per PR
5. **Add comments** for complex logic
6. **Update docs** when changing API or features
7. **Follow existing code style** - ESLint/Prettier handle it

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [ASP.NET Core Docs](https://learn.microsoft.com/en-us/aspnet/core)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Vite Guide](https://vitejs.dev/guide)

---

Happy coding! 🚀
