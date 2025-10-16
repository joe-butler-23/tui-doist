# TUIist - Terminal-Style Task Manager

A modern task management application with a terminal-style UI, built with React and Node.js.

## 🚀 Quick Start

### Backend Server
The backend API is running at: **http://localhost:3001/**

- **API Documentation**: Visit `http://localhost:3001/` for complete API docs
- **Health Check**: `http://localhost:3001/health`
- **Projects API**: `http://localhost:3001/api/projects`
- **Tasks API**: `http://localhost:3001/api/tasks`

### Frontend Application
The React frontend is running at: **http://localhost:3000/**

Open your browser and navigate to `http://localhost:3000/` to see the TUI-style task manager interface.

## 🎯 Features

### Frontend (React + TypeScript + Tailwind)
- **Terminal-Style UI**: Vim-inspired keyboard navigation
- **Three-Pane Layout**: Projects, Tasks, and Context
- **Keyboard Shortcuts**: 
  - `h/l` - Navigate between panes
  - `j/k` - Navigate up/down
  - `a` - Add new project/task
  - `x` - Toggle task completion
  - `d` - Delete selected item
  - `Enter` - Expand context/edit notes
  - `i` - Edit notes
  - `b` - Open bookmarks from notes
  - `ESC` - Cancel/collapse

### Backend (Fastify + TypeScript + Prisma)
- **RESTful API**: Complete CRUD operations for projects and tasks
- **SQLite Database**: Local data persistence
- **Todoist Integration**: Ready for sync with Todoist API
- **Type Safety**: Full TypeScript support
- **API Documentation**: Self-documenting endpoints

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Manual API Testing
```bash
# Test health endpoint
curl http://localhost:3001/health

# Create a project
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "color": "blue"}'

# Create a task
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"text": "Test task", "projectId": "PROJECT_ID"}'
```

## 📁 Project Structure

```
tuiist/
├── backend/           # Fastify API server
│   ├── src/
│   │   ├── routes/    # API routes
│   │   ├── services/  # Business logic
│   │   └── schemas/   # Type definitions
│   ├── prisma/        # Database schema
│   └── test-api.js    # API testing script
├── frontend/          # React application
│   └── src/
│       ├── TUITaskManager.tsx  # Main component
│       ├── App.tsx
│       └── main.tsx
└── README.md
```

## 🛠️ Development

### Backend Development
```bash
cd backend
npm run dev  # Starts server on port 3001
```

### Frontend Development
```bash
cd frontend
npm run dev  # Starts dev server on port 3000
```

## 🔧 Configuration

- **Backend**: Uses SQLite database (`backend/prisma/dev.db`)
- **Frontend**: Proxies API requests to backend automatically
- **CORS**: Configured for localhost development
- **Todoist**: API integration ready (requires TODOIST_API_KEY in .env)

## 📝 Current Status

✅ **Working Features:**
- Backend API with full CRUD operations
- Frontend TUI-style interface
- Keyboard navigation
- Local data persistence
- Project and task management
- Context notes and bookmarks

🔄 **Next Steps:**
- Connect frontend to backend API
- Implement Todoist sync
- Add user authentication
- Deploy to production

---

**Now you can see your frontend at `http://localhost:3000/` and your backend API at `http://localhost:3001/`!**
