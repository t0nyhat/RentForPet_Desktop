# How to Help

[Russian version →](CONTRIBUTING.md)

Any contribution is welcome! Whether it's a typo in docs, a bug, or a new feature.

## Quick Start

```bash
git clone https://github.com/t0nyhat/PetForRentDesktop.git
cd PetForRentDesktop
npm install && cd frontend && npm install && cd ..
npm run dev
```

Frontend will open at http://localhost:5173 and API at http://localhost:5226

## What to Change?

### Small Fixes (typos, docs)

Just send a PR directly to `main`. Pre-commit checks will run automatically.

### New Features or Bug Fixes

1. Create a branch: `git checkout -b feature/your-improvement`
2. Make changes
3. Run tests:
   ```bash
   npm run test          # frontend
   dotnet test          # backend
   ```
4. Send a PR with description

## Structure

```
frontend/           # React components, pages
PetHotel.API/       # .NET API with business logic
PetHotel.Tests/     # Tests
```

Full guide in [DEVELOPMENT.md](DEVELOPMENT.md)

## Commits

Just use clear messages:

```
feat: added new feature
fix: fixed a bug
docs: updated docs
```

Version will be bumped automatically when merged to main.

## Questions?

Open an [Issue](https://github.com/t0nyhat/PetForRentDesktop/issues) or start a discussion.

Thanks for your interest! 🚀
