# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Enterprise AI chat application with multiple deployment modes:
- **Simple mode**: Basic chat functionality with Ollama integration
- **Secure mode**: SSL-enabled with JWT authentication
- **Enterprise mode**: Full-featured with PostgreSQL, Redis, MongoDB, Box integration, LDAP
- **Multi-provider mode**: Support for Ollama, Gemini API, OpenAI API
- **MAC Authentication mode**: Device-based authentication with Google Sheets integration
- **Cloud mode**: Cloudflare Workers + Pages deployment (no Docker/LocalTunnel needed)

**Primary Use Case**: Enterprise-grade AI chat with security features, knowledge base RAG, multi-provider support, and cloud deployment options. Full Japanese language support.

**Node.js Requirement**: >= 18.0.0

## Commands

### Quick Start
```bash
# Auto setup and start (recommended)
./start-simple.sh
./start-mac-auth.sh            # With MAC address authentication

# Mode switching
./switch-mode.sh simple        # Basic mode
./switch-mode.sh secure        # SSL + authentication
./switch-mode.sh enterprise    # Full enterprise features

# Windows users
start.bat                      # PowerShell launcher
start-mac-auth.bat            # With MAC authentication
start.ps1                      # PowerShell script version
stop.ps1                       # Stop all services

# Setup scripts
./server-setup.sh              # Initial server setup
./server-setup-windows.bat     # Windows server setup
./setup-secure.sh              # Generate SSL certificates
./setup-enhanced.sh            # Enhanced mode setup

# Diagnostics
./diagnose.sh                  # System health check
./check-network.bat            # Windows network check
./close-port.bat              # Close ports (Windows)
```

### Docker Operations
```bash
# Start services (mode-specific)
docker-compose up -d --build
docker-compose -f docker-compose-secure.yml up -d --build
docker-compose -f docker-compose-enterprise.yml up -d --build
docker-compose -f docker-compose-mac-auth.yml up -d --build

# Stop services
docker-compose down
docker-compose -f docker-compose-secure.yml down

# View logs
docker-compose logs backend --tail 50
docker-compose logs frontend --tail 50
docker-compose logs ollama

# Container access
docker exec -it chat-backend sh
docker exec -it ollama sh
```

### Backend Development
```bash
cd backend
npm install
npm run dev                    # server-enterprise.js with nodemon
npm run dev:simple            # server.js with nodemon
npm run start:multi           # server-multi.js
npm run lint                  # ESLint check
npm run format                # Prettier formatting
npm test                      # Jest tests
npm test -- --watch           # Run tests in watch mode
npm test -- auth-manager.test.js  # Run specific test file
```

### Ollama Model Management
```bash
# Download models
docker exec -it ollama ollama pull llama2
docker exec -it ollama ollama pull gemma2:2b
docker exec -it ollama ollama pull codellama
docker exec -it ollama ollama pull mistral

# List installed models
docker exec -it ollama ollama list

# Model info
docker exec -it ollama ollama show llama2
```

## Architecture

### Server Variants
- **server.js**: Basic Ollama-only chat server with streaming responses
- **server-multi.js**: Multi-provider support (Ollama, Gemini, OpenAI) with knowledge base
- **server-secure.js**: SSL + JWT authentication with MongoDB session/audit logging
- **server-enterprise.js**: Full enterprise features with monitoring, Box API, LDAP, vector search
- **server-mac-auth.js**: MAC address authentication variant with Google Sheets integration
- **server-mac-auth-simple.js**: Simplified MAC authentication without enterprise features

**Default Server by Mode**:
- Simple mode: Uses `server-multi.js`
- Secure mode: Uses `server-secure.js`
- Enterprise mode: Uses `server-enterprise.js`
- MAC Auth mode: Uses `server-mac-auth.js`

### Key Backend Components
- **knowledge-loader-enhanced.js**: PDF/document processing for RAG with lazy loading
- **auth-manager.js**: JWT authentication (8h expiry), LDAP integration, role-based permissions
- **auth-corporate.js**: Corporate authentication module with enterprise SSO
- **box-integration.js**: Box API file management
- **database-manager.js**: MongoDB connection pooling
- **database-manager-mongo.js**: MongoDB-specific database operations
- **cache-manager.js**: Redis caching layer
- **vector-search.js**: Vector similarity search for knowledge base
- **kintone-connector.js**: Kintone integration for enterprise data
- **monitoring-manager.js**: Winston logging and metrics collection
- **mac-auth-middleware.js**: MAC address authentication middleware
- **knowledge-manager.js**: Knowledge base management utilities
- **enhanced-research-manager-jp.js**: Web search integration with Google Custom Search API (Japanese optimized)
- **aiyu-personality.js**: Mascot personality system with conditional "wan" suffix

### Frontend Structure
- **app-enhanced.js**: Main application with markdown support (DOM must be in DOMContentLoaded)
- **app-multi.js**: Multi-provider frontend
- **app-secure.js**: Security-focused frontend with JWT handling
- **app-simple.js**: Basic chat interface
- **meeting.js**: Meeting transcription functionality
- **admin.html**: Admin dashboard for user management
- **knowledge-manager.html**: Knowledge base management UI
- **box-manager.html**: Box API file management interface

**Frontend Deployment Options**:
- Docker: Changes require rebuild `docker-compose build frontend`
- Cloudflare Pages: Located in `frontend-deploy/` directory, auto-deploys on GitHub push
- Features in frontend-deploy: Research mode, personality toggle, persistent chat titles

### Docker Compose Configurations
- **docker-compose.yml**: Basic setup (backend + frontend only)
- **docker-compose-secure.yml**: SSL-enabled with authentication
- **docker-compose-enterprise.yml**: Full stack with PostgreSQL, Redis, MongoDB, optional monitoring
- **docker-compose-share.yml**: Network share configuration
- **docker-compose-mac-auth.yml**: MAC address authentication with Google Sheets
- **docker-compose-frontend-only.yml**: Frontend-only deployment

## Environment Variables (.env)

```bash
# AI Provider APIs
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
OLLAMA_HOST=http://ollama:11434

# Authentication
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# Database connections
MONGODB_URI=mongodb://mongodb:27017/chat
REDIS_URL=redis://redis:6379
POSTGRES_PASSWORD=securepassword123

# Enterprise integrations
BOX_CLIENT_ID=your_box_client_id
BOX_CLIENT_SECRET=your_box_secret
LDAP_URL=ldap://ldap.company.com:389
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=ldap_password

# SSL (for secure mode)
SSL_KEY_PATH=/app/ssl/private.key
SSL_CERT_PATH=/app/ssl/certificate.crt

# MAC Authentication
MAC_AUTH_ENABLED=true
GOOGLE_SHEET_ID=1wk53Cjx4NBI0z-UG9BmNn0P4sImrlnt--l0hLZv3B6o

# Optional
KINTONE_DOMAIN=your-subdomain.cybozu.com
KINTONE_API_TOKEN=your_kintone_token

# Google Custom Search API (Web search feature)
SEARCH_API_KEY=your_google_api_key
SEARCH_ENGINE_ID=your_search_engine_id
```

## Port Configuration

- **8080**: Frontend (nginx) - HTTP
- **8443**: Frontend (nginx) - HTTPS (secure/enterprise modes)
- **3001**: Backend API
- **11434**: Ollama API
- **5432**: PostgreSQL (enterprise mode)
- **27017**: MongoDB (enterprise mode)
- **6379**: Redis (enterprise mode)

## Critical Implementation Notes

### IMPORTANT: Ollama Models
**DO NOT download Ollama models using `ollama pull` commands**. The models should already be available or will be managed separately by the user.

### Frontend DOM Initialization
app-enhanced.js requires all DOM elements to be initialized inside DOMContentLoaded event listener. Never access DOM elements in global scope.

### Knowledge Base Setup
1. Place PDF files in `knowledge/` directory
2. Set `useKnowledge: true` in API requests
3. Knowledge loader automatically processes PDFs on startup with lazy loading
4. Supports PDF, Word documents (.docx), and Excel files (.xlsx)
5. Japanese language documents are fully supported

### Security Features
- Personal info masking regex in server-enterprise.js
- Rate limiting: 100 requests per 15 minutes per IP
- JWT tokens expire after 8 hours (auth-manager.js)
- Helmet.js for security headers
- Input validation with express-validator
- MAC address authentication option
- Auto-logout after 30 minutes of inactivity

### Multi-Provider Routing
server-multi.js routes based on model prefix:
- `gemini-*`: Google Gemini API
- `gpt-*`: OpenAI API
- Default: Ollama local models

### File Structure Requirements
- Backend changes: Just restart container (`docker-compose restart backend`)
- Frontend changes: Rebuild required (`docker-compose build frontend`)
- SSL certificates: Place in `ssl/` directory
- Knowledge base PDFs: Place in `knowledge/` directory
- Uploaded files: Stored in `uploads/` directory
- Service account key: Place in `backend/service-account-key.json` (for MAC auth)
- Logs: Stored in `logs/` directory (app.log, audit.log, error.log, combined.log)

## Testing

```bash
# Backend tests
cd backend
npm test

# API endpoint testing
./test-api.sh

# API health check
curl http://localhost:3001/api/health

# Model availability
curl http://localhost:3001/api/models

# Chat with knowledge base
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test","model":"llama2","useKnowledge":true}'
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs backend
docker-compose logs ollama

# Rebuild containers
docker-compose down
docker-compose up -d --build

# Run diagnostics
./diagnose.sh
```

### Models not responding
```bash
# Verify Ollama is running
docker exec -it ollama ollama list

# Check connectivity
docker exec -it chat-backend curl http://ollama:11434/api/tags
```

### Knowledge base not working
- Verify PDFs exist in `knowledge/` directory
- Check backend logs for PDF parsing errors
- Ensure `useKnowledge: true` is in request body
- For Japanese PDFs, ensure proper encoding

### SSL certificate issues (secure mode)
```bash
# Regenerate certificates
./setup-secure.sh

# Or manually create
openssl req -x509 -newkey rsa:4096 -keyout ssl/private.key -out ssl/certificate.crt -days 365 -nodes
```

### MAC Authentication issues
- Verify `backend/service-account-key.json` exists
- Check Google Sheets API is enabled
- Ensure spreadsheet is shared with service account email
- Run `arp -a` to verify MAC address visibility
- Check logs: `docker-compose -f docker-compose-mac-auth.yml logs backend`

## Development Workflow

### Adding New Features
1. Choose appropriate server variant (server.js for basic, server-multi.js for providers, etc.)
2. Frontend DOM manipulation must be in DOMContentLoaded
3. Run tests: `cd backend && npm test`
4. Lint code: `npm run lint`
5. Format code: `npm run format`

### Common Tasks
```bash
# Switch between modes
./switch-mode.sh simple|secure|enterprise

# Add new Ollama model
docker exec -it ollama ollama pull model-name

# Check API health
curl http://localhost:3001/api/health

# Test with knowledge base
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"query","model":"llama2","useKnowledge":true}'
```

### Directory Structure
```
/
├── backend/           # Node.js servers and utilities
│   ├── knowledge/     # Knowledge base documents
│   └── service-account-key.json  # Google service account
├── frontend/          # Static web files (nginx)
│   └── aiyu-icons/   # Japanese UI icons
├── knowledge/         # PDF files for RAG
├── ssl/              # SSL certificates
├── logs/             # Application logs
├── uploads/          # User uploaded files
├── old-docs/         # Legacy documentation
├── installer/        # Windows installation scripts
└── docker-compose*.yml # Deployment configurations
```

### Project Path
Default installation path:
- Linux/WSL: `/mnt/c/Users/iwanaga/社内開発/Docker/test/ollama-chat-app`
- Windows: `C:\Users\iwanaga\社内開発\Docker\test\ollama-chat-app`

## Additional Important Notes

### Cloudflare Deployment (Recommended for External Access)
**Frontend**: Deployed at https://ai-chat-frontend-9g0.pages.dev
- Repository: github.com/nakamichi0118/ai-chat-frontend
- Frontend code in `frontend-deploy/` directory
- Auto-deploys on push to main branch
- Includes research mode, personality toggle, chat title persistence

**Backend**: Cloudflare Worker at ai-chat-backend-full.masakazu199018.workers.dev
- File: cloudflare-worker-full.js
- Supports Gemini 2.5/2.0/1.5 and GPT-4/3.5 models
- Features: Date handling, web search, personality mode
- Environment variables required: GEMINI_API_KEY, OPENAI_API_KEY (optional), SEARCH_API_KEY, SEARCH_ENGINE_ID

### Frontend Code Location
- **Docker deployment**: `frontend/` directory
- **Cloudflare deployment**: `frontend-deploy/` directory (newer, has research mode)

### LocalTunnel Setup (Legacy)
When using Docker backend and PC restarts:
1. Start LocalTunnel: `npx localtunnel --port 3001`
2. Update Cloudflare Worker with new URL
3. Access via frontend URL

### Web Search Feature
- Requires Google Custom Search API key and Search Engine ID
- Set in `.env`: `SEARCH_API_KEY` and `SEARCH_ENGINE_ID`
- Japanese search optimized with `lr=lang_ja`, `gl=jp` parameters
- Research manager analyzes queries for date, news, company info

### Aiyu-kun Personality Mode
- Toggle button "アイユーくんモード" in UI
- Controlled by `usePersonality` flag in API requests
- 30% chance of adding "ワン" suffix when enabled
- Automatically disabled for formal contexts (legal, tax, documentation)
- Default: OFF (user feedback: too noisy when always on)

### Research Mode Feature
- Toggle button "リサーチ" in UI (replaced meeting button)
- Forces web search for all queries when enabled
- Auto-triggers for: dates, news, current events, stock prices, weather
- Controlled by `useResearch` flag in API requests

### MAC Address Authentication Setup
1. Create service account in Google Cloud Console
2. Enable Google Sheets API
3. Download JSON key as `backend/service-account-key.json`
4. Share spreadsheet with service account email
5. Spreadsheet ID: `1wk53Cjx4NBI0z-UG9BmNn0P4sImrlnt--l0hLZv3B6o`

### Japanese Language Support
- UI includes Japanese text and icons (aiyu-icons)
- Personal info masking handles Japanese formats (phone numbers, addresses)
- Knowledge base fully supports Japanese PDFs
- Meeting transcription supports Japanese audio
- Web search results prioritize Japanese content

### Security Considerations
- Docker host networking required for MAC auth (to access ARP tables)
- JWT tokens stored in httpOnly cookies
- All API endpoints validate JWT except health/models
- Rate limiting applied per IP address
- Audit logs track all user actions

### Performance Tips
- Use `gemma2:2b` for faster responses on limited hardware
- Enable Redis caching in enterprise mode
- Lazy loading implemented for knowledge base
- Vector search optimized for Japanese text
- Limit web search results to improve response time
- For cloud deployment: Use Cloudflare Workers to avoid PC resource usage

### Deployment Best Practices
- Always use HTTPS in production
- Restrict ports via firewall rules
- Regular backup of MongoDB data
- Monitor logs in `logs/` directory
- Update MAC address whitelist regularly
- For Cloudflare deployment: Update Worker environment variables in dashboard

### Current Status Notes
- **Preferred deployment**: Cloudflare Workers + Pages (no local resources needed)
- **Date handling**: Fixed to return correct JST dates (e.g., 2025年8月27日)
- **Chat titles**: Persist across page reloads and version updates
- **Model support**: Gemini 2.5 Flash/Pro, GPT-4, all via Cloudflare Worker
- **Known issue**: BOX integration pending for cloud deployment