# Quick Setup Guide - Moving to Another Computer

## The Absolute Easiest Way

### Step 1: Copy the Project Folder

Simply copy this entire `markdown-mermaid-renderer` folder to your other computer:
- USB drive
- Cloud storage (Dropbox, Google Drive, etc.)
- Network share
- Email/file transfer

**That's it!** Just copy the whole folder.

### Step 2: Run on the New Computer

On the new computer (with Docker installed):

**Mac (Double-Click Method):**
1. Double-click `start.command` file
2. That's it!

**Mac (Terminal Method):**
```bash
cd markdown-mermaid-renderer
./start.sh
```

**Linux:**
```bash
cd markdown-mermaid-renderer
./start.sh
```

**Windows:**
1. Double-click `start.bat` file
   OR
2. Open Command Prompt and run:
```
cd markdown-mermaid-renderer
start.bat
```

**Any OS (with docker-compose):**
```bash
docker-compose up -d
```

The app will automatically:
- Build the Docker image
- Start the container
- Open http://localhost:8080 in your browser

---

## Essential Files Needed

You only need these files (everything else is optional):
- ✅ `index.html` - The app
- ✅ `Dockerfile` - How to build it
- ✅ `docker-compose.yml` - Easy startup
- ✅ `nginx.conf` - Web server config
- ✅ `start.command` - Mac double-click startup
- ✅ `start.sh` - Mac/Linux terminal startup
- ✅ `start.bat` - Windows double-click startup

Total size: **~35KB** (tiny!)

---

## Alternative: Save/Load Docker Image

If you want to skip the build step on the new computer:

### On Computer A (this computer):

```bash
# Save the Docker image to a file
docker save markdown-mermaid-renderer:latest | gzip > markdown-renderer.tar.gz
```

This creates a ~25MB file you can transfer.

### On Computer B (new computer):

```bash
# Load the image
gunzip -c markdown-renderer.tar.gz | docker load

# Run it
docker run -d -p 8080:80 --name markdown-renderer markdown-mermaid-renderer:latest
```

Open http://localhost:8080

---

## Prerequisites on New Computer

The new computer only needs:
1. **Docker Desktop** installed ([docker.com](https://docker.com))
2. **Docker running** (start Docker Desktop)

That's it! No Node.js, no npm, nothing else needed.

---

## Verify Docker is Ready

```bash
# Check Docker is installed
docker --version

# Check Docker is running
docker ps
```

If both work, you're ready!

---

## Quick Commands

```bash
# Start
./start.sh                    # Mac/Linux
start.bat                     # Windows
docker-compose up -d          # Any OS

# Stop
docker stop markdown-renderer

# View logs
docker logs -f markdown-renderer

# Restart
docker restart markdown-renderer

# Remove
docker stop markdown-renderer && docker rm markdown-renderer
```

---

## Troubleshooting

**Port 8080 already in use?**
```bash
# Use a different port
docker run -d -p 3000:80 --name markdown-renderer markdown-mermaid-renderer:latest
# Then visit http://localhost:3000
```

**Container won't start?**
```bash
# Check logs
docker logs markdown-renderer
```

**Want to rebuild?**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## File Size Summary

- **Project files:** ~30KB
- **Docker image:** ~25MB
- **Total with Docker:** ~25MB

Compare to traditional apps: 100MB-500MB+

---

## That's It!

The easiest workflow:
1. Copy the `markdown-mermaid-renderer` folder to a USB drive
2. Plug into new computer
3. Run `./start.sh` (Mac/Linux) or `start.bat` (Windows)
4. Visit http://localhost:8080

No installation, no dependencies, no configuration. Just copy and run!
