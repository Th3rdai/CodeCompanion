<p align="center">
  <img src="resources/th3rdai-logo-sm.png" alt="Th3rdAI" width="150" />
</p>

# Contributing to Code Companion

Thanks for your interest in contributing! Code Companion is an open-source project by [Th3rdAI](https://github.com/Th3rdai).

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Start the dev servers: `npm run dev`
5. Make sure [Ollama](https://ollama.com) is running locally

## Development

- **Backend:** `node server.js` (Express on port 3000)
- **Frontend:** `npx vite` (React + Tailwind on port 5173)
- **Both:** `npm run dev` (Vite + Express together)
- **Production-style run:** `./deploy.sh` or `npm run build && ./startup.sh`

## Pull Requests

- Create a feature branch from `master`
- Keep changes focused — one feature or fix per PR
- Test your changes locally before submitting
- Write a clear PR description explaining what and why

## Code Style

- React functional components with hooks
- Tailwind CSS for styling (no separate CSS files)
- Express routes in `server.js`, business logic in `lib/`
- Friendly-teacher tone in all user-facing text — analogies, no jargon

## Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your OS and Node.js version

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
