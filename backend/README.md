# TUIist Backend

A Fastify-based backend server for the TUIist task management application with Todoist integration.

## Features

- **RESTful API**: Complete CRUD operations for projects and tasks
- **Todoist Integration**: Two-way sync with Todoist API
- **PostgreSQL Database**: Persistent storage with Prisma ORM
- **TypeScript**: Full type safety
- **Sync Management**: Track sync status and logs
- **Health Checks**: Monitoring endpoint

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Todoist API token (optional, for sync functionality)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/tuiist"

# Server
PORT=3001
NODE_ENV=development

# Todoist (optional)
TODOIST_API_TOKEN="your_todoist_api_token"
```

4. Generate Prisma client:
```bash
npx prisma generate
```

5. Run database migrations:
```bash
npx prisma migrate dev
```

6. Start the server:
```bash
npm run dev
```

The server will start on `http://localhost:3001`.

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get single project
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/tasks` - List all tasks (optionally filter by projectId)
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/toggle` - Toggle task completion
- `DELETE /api/tasks/:id` - Delete task

### Sync
- `POST /api/sync` - Sync with Todoist
- `GET /api/sync/status` - Get sync status
- `GET /api/sync/logs` - Get sync logs

## Sync Operations

The sync endpoint supports three directions:

1. **FROM_TODOIST**: Pull changes from Todoist to local database
2. **TO_TODOIST**: Push local changes to Todoist
3. **BIDIRECTIONAL**: Push local changes, then pull from Todoist

Example sync request:
```json
{
  "direction": "BIDIRECTIONAL",
  "entityType": "all"
}
```

## Database Schema

The application uses the following main entities:

- **Project**: Task containers with sync status
- **Task**: Individual tasks with priority, due dates, and sync status
- **SyncLog**: Audit trail of all sync operations

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run test` - Run tests
- `prisma studio` - Open Prisma Studio for database management

### Code Structure

```
src/
├── routes/          # API route handlers
│   ├── projects.ts  # Project CRUD operations
│   ├── tasks.ts     # Task CRUD operations
│   └── sync.ts      # Sync operations
├── services/        # Business logic
│   └── todoist.ts   # Todoist API integration
├── schemas/         # Validation schemas
│   └── task.ts      # Zod schemas
└── server.ts        # Server configuration
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `TODOIST_API_TOKEN` | Todoist API token for sync | No |

## Deployment

1. Build the application:
```bash
npm run build
```

2. Set production environment variables

3. Run database migrations:
```bash
npx prisma migrate deploy
```

4. Start the server:
```bash
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT
