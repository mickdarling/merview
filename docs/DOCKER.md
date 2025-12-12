# Docker Quick Reference

## Quick Start

```bash
# Start with docker-compose (easiest)
docker-compose up -d

# Access at http://localhost:8080
```

## Basic Commands

### Using Docker Compose (Recommended)

```bash
# Start container in background
docker-compose up -d

# Stop container
docker-compose down

# View logs
docker-compose logs -f

# Restart container
docker-compose restart

# Check status
docker-compose ps
```

### Using Docker CLI

```bash
# Build image
docker build -t markdown-mermaid-renderer:latest .

# Run container
docker run -d -p 8080:80 --name markdown-renderer markdown-mermaid-renderer:latest

# Stop container
docker stop markdown-renderer

# Remove container
docker rm markdown-renderer

# View logs
docker logs -f markdown-renderer

# Check status
docker ps | grep markdown-renderer
```

### Using npm Scripts

```bash
# Docker Compose
npm run docker:compose:up      # Start
npm run docker:compose:down    # Stop
npm run docker:compose:logs    # View logs

# Docker CLI
npm run docker:build           # Build image
npm run docker:run             # Run container
npm run docker:stop            # Stop and remove
npm run docker:logs            # View logs
```

## Port Configuration

Default port is 8080. To change:

**docker-compose.yml:**
```yaml
ports:
  - "3000:80"  # Change 8080 to 3000
```

**Docker CLI:**
```bash
docker run -d -p 3000:80 --name markdown-renderer markdown-mermaid-renderer:latest
```

## Moving to Another Computer

### Method 1: Save/Load Image (No Internet Required)

```bash
# On computer A: Save image to file
docker save markdown-mermaid-renderer:latest | gzip > markdown-renderer.tar.gz

# Transfer file to computer B (USB, network, etc.)

# On computer B: Load image
gunzip -c markdown-renderer.tar.gz | docker load

# Run it
docker run -d -p 8080:80 --name markdown-renderer markdown-mermaid-renderer:latest
```

### Method 2: Use Docker Hub (Requires Internet)

```bash
# On computer A: Push to Docker Hub
docker tag markdown-mermaid-renderer:latest yourusername/markdown-renderer:latest
docker login
docker push yourusername/markdown-renderer:latest

# On computer B: Pull and run
docker pull yourusername/markdown-renderer:latest
docker run -d -p 8080:80 --name markdown-renderer yourusername/markdown-renderer:latest
```

### Method 3: Copy Project Files

```bash
# Copy entire project directory to new computer
# Then build and run
docker-compose up -d
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 8080
lsof -i :8080

# Use different port
docker run -d -p 8081:80 --name markdown-renderer markdown-mermaid-renderer:latest
```

### Container Won't Start

```bash
# Check logs
docker logs markdown-renderer

# Check health
docker inspect markdown-renderer | grep -A 10 Health
```

### Rebuild After Changes

```bash
# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Clean Up

```bash
# Remove container
docker-compose down

# Remove image
docker rmi markdown-mermaid-renderer:latest

# Clean up everything (careful!)
docker system prune -a
```

## Health Check

The container includes a health check endpoint:

```bash
# Check health status
curl http://localhost:8080/health

# Docker health check
docker inspect markdown-renderer | grep -A 10 Health
```

## Container Information

```bash
# View container details
docker inspect markdown-renderer

# View resource usage
docker stats markdown-renderer

# Execute command in container
docker exec -it markdown-renderer sh

# View nginx logs
docker exec markdown-renderer cat /var/log/nginx/access.log
```

## Image Details

- **Base Image:** nginx:alpine
- **Size:** ~25MB (very lightweight!)
- **Ports:** 80 (internal), 8080 (external)
- **Health Check:** Built-in at /health endpoint
- **Auto-restart:** Yes (unless-stopped policy)

## Security Notes

The nginx configuration includes:
- GZIP compression
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- Hidden files protection
- Proper cache control
- Health check endpoint

## Production Deployment

For production use, consider:

1. **Use specific image tags** (not :latest)
   ```bash
   docker build -t markdown-mermaid-renderer:1.0.0 .
   ```

2. **Set resource limits**
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '0.5'
         memory: 128M
   ```

3. **Use HTTPS** with reverse proxy (nginx, traefik, etc.)

4. **Enable monitoring** with health checks

5. **Set up backups** if you add data persistence
