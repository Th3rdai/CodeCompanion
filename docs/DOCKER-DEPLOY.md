# Docker Deployment Guide

Deploy Code Companion with Docker Compose, including an Ollama LLM sidecar for local AI inference.

## Prerequisites

- **Docker Engine**: 24.0+ ([install](https://docs.docker.com/engine/install/))
- **Docker Compose**: v2.0+ (included with Docker Desktop; verify with `docker compose version`)
- **System Requirements**:
  - 8GB RAM minimum (16GB recommended for larger models)
  - 20GB disk space for base installation
  - Additional space for Ollama models (varies by model size)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/th3rdai/CodeCompanion.git
cd CodeCompanion
```

### 2. Configure Environment (Optional)

Create a `.env` file in the project root for custom configuration:

```bash
# Optional: Set API secret for non-localhost access
CC_API_SECRET=your-secret-key-here

# Optional: Enable debug logging
DEBUG=1

# Optional: Custom project folder mount
PROJECT_FOLDER=/path/to/your/projects
```

### 3. Start the Stack

```bash
docker compose up -d
```

This will:

- Pull the Ollama image
- Build the Code Companion image
- Start both services
- Wait for health checks to pass

### 4. Verify Deployment

Open your browser to **http://localhost:8900**

Check service status:

```bash
docker compose ps
docker compose logs -f codecompanion
```

### 5. Pull Ollama Models

Pull your preferred models into the Ollama container:

```bash
# Example: Pull Llama 3.3 70B
docker compose exec ollama ollama pull llama3.3:70b-instruct-q4_K_M

# Example: Pull Qwen 2.5 Coder
docker compose exec ollama ollama pull qwen2.5-coder:32b-instruct-q4_K_M

# List available models
docker compose exec ollama ollama list
```

## Configuration

### Environment Variables

| Variable         | Default               | Description                                                                               |
| ---------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `HOST`           | `0.0.0.0`             | Server bind address (0.0.0.0 for Docker)                                                  |
| `PORT`           | `8900`                | Application port                                                                          |
| `OLLAMA_URL`     | `http://ollama:11434` | Ollama service URL (**must** use service name in Compose)                                 |
| `CC_API_SECRET`  | _(empty)_             | API secret for non-localhost access (required when accessing from outside Docker network) |
| `DEBUG`          | `0`                   | Enable debug logging (set to `1`)                                                         |
| `PROJECT_FOLDER` | _(empty)_             | Project folder path for File Browser                                                      |

**Important**: `OLLAMA_URL` must use the Docker service name (`http://ollama:11434`) when running in Docker Compose. Do not use `localhost` or `127.0.0.1`.

### Volume Mounts

The stack creates two named volumes for data persistence:

| Volume        | Purpose                                               | Container Path  |
| ------------- | ----------------------------------------------------- | --------------- |
| `ollama_data` | Ollama models and configuration                       | `/root/.ollama` |
| `cc_data`     | Code Companion data (conversations, settings, memory) | `/app/data`     |

**Optional**: Mount a project folder for the File Browser:

```yaml
# In docker-compose.yml under codecompanion.volumes:
- /path/to/your/projects:/app/projects:ro
```

Then set `PROJECT_FOLDER=/app/projects` in the environment.

## Operations

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f codecompanion
docker compose logs -f ollama

# Last 50 lines
docker compose logs --tail=50 codecompanion
```

### Stop Services

```bash
# Stop (preserves data)
docker compose stop

# Stop and remove containers (preserves volumes)
docker compose down

# Stop and remove everything including volumes (⚠️ deletes data)
docker compose down -v
```

### Restart Services

```bash
docker compose restart
```

### Update to Latest Version

```bash
# Pull latest code
git pull origin master

# Rebuild and restart
docker compose up -d --build
```

### Health Checks

Both services include health checks:

```bash
# Check status
docker compose ps

# Manual health check
curl http://localhost:8900/api/health
# Expected: {"status":"ok","version":"1.6.48"}

docker compose exec ollama curl -f http://localhost:11434/api/tags
# Expected: JSON list of models
```

## Backup and Restore

### Backup Data

```bash
# Create backup directory
mkdir -p backups

# Backup both volumes
docker run --rm \
  -v codecompanion_cc_data:/data:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/cc_data_$(date +%Y%m%d).tar.gz -C /data .

docker run --rm \
  -v codecompanion_ollama_data:/data:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/ollama_data_$(date +%Y%m%d).tar.gz -C /data .
```

### Restore Data

```bash
# Stop services first
docker compose down

# Restore Code Companion data
docker run --rm \
  -v codecompanion_cc_data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/cc_data_YYYYMMDD.tar.gz"

# Restore Ollama data
docker run --rm \
  -v codecompanion_ollama_data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/ollama_data_YYYYMMDD.tar.gz"

# Start services
docker compose up -d
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose logs

# Check disk space
docker system df

# Clean up unused resources
docker system prune -a
```

### Can't Connect to Ollama

Verify the `OLLAMA_URL` environment variable:

- **Must** be `http://ollama:11434` (Docker service name)
- **Not** `http://localhost:11434` or `http://127.0.0.1:11434`

```bash
# Test from codecompanion container
docker compose exec codecompanion curl http://ollama:11434/api/tags
```

### Port Already in Use

Change the port mapping in `docker-compose.yml`:

```yaml
services:
  codecompanion:
    ports:
      - "9000:8900" # Host:Container
```

### Out of Memory

Increase Docker resource limits:

- Docker Desktop: Settings → Resources → Memory
- Linux: System memory available to Docker

### Permission Denied on Volumes

```bash
# Fix volume permissions
docker compose down
docker volume rm codecompanion_cc_data codecompanion_ollama_data
docker compose up -d
```

## Security Considerations

### Network Access

By default, Code Companion binds to `0.0.0.0` in Docker for container networking. To restrict access:

1. **Localhost only** (via reverse proxy):

   ```yaml
   ports:
     - "127.0.0.1:8900:8900"
   ```

2. **API Secret** (for non-localhost access):

   ```bash
   # Set in .env file
   CC_API_SECRET=$(openssl rand -base64 32)
   ```

3. **HTTPS** (via reverse proxy):
   Use nginx, Traefik, or Caddy as a reverse proxy with TLS termination.

### Updating

Regularly update both the application and Ollama:

```bash
# Update Code Companion
git pull && docker compose up -d --build

# Update Ollama
docker compose pull ollama
docker compose up -d ollama
```

## Performance Tuning

### GPU Support (NVIDIA)

For GPU acceleration with Ollama:

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

Requires [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html).

### Resource Limits

Prevent resource exhaustion:

```yaml
services:
  codecompanion:
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 4G
        reservations:
          cpus: "1.0"
          memory: 2G
```

## Development

### Local Development with Docker

Mount source code for live reload:

```yaml
services:
  codecompanion:
    build:
      context: .
      target: builder # Use builder stage
    volumes:
      - ./src:/app/src
      - ./lib:/app/lib
    command: ["npm", "run", "dev"]
```

### Testing

Run the smoke test:

```bash
npm run smoke:docker
```

This will:

1. Start the stack
2. Poll `/api/health` until HTTP 200
3. Tear down (max 60 seconds)

## Support

- **Documentation**: See `docs/` directory
- **Issues**: https://github.com/th3rdai/CodeCompanion/issues
- **Troubleshooting**: `docs/TROUBLESHOOTING.md`

## License

See [LICENSE](../LICENSE) file.
