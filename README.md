# API Interceptor

A local web service for mocking, intercepting, and logging API requests. Inspired by Beeceptor, this tool lets you define custom endpoints, responses, delays, and error statuses, with a modern UI and persistent logging.

## Features
- Define API endpoints and custom responses (status, body, delay, error)
- View and log incoming requests with details (body, query, IP, user-agent, headers)
- Edit and delete endpoints via the UI
- Auto-refreshing logs, with modal dialog for full request details
- SQLite database for persistent storage
- Easy setup and management with root-level scripts

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Install dependencies
From the project root:
```
npm run install-all
```

### Run the servers
From the project root:
```
npm run start-all
```
- Backend runs on [http://localhost:4000](http://localhost:4000)
- Frontend runs on [http://localhost:4001](http://localhost:4001)

### Usage
- Open the frontend in your browser
- Add, edit, or delete endpoints
- Send requests to your defined endpoints
- View logs and inspect request details

## Project Structure
```
api-interceptor/
  backend/        # Express server, SQLite database
  frontend/       # React UI
  package.json    # Root scripts and workspaces
  .gitignore      # Recommended ignores
```

## Scripts
- `npm run install-all` — Install dependencies for backend and frontend
- `npm run start-backend` — Start backend server
- `npm run start-frontend` — Start frontend server
- `npm run start-all` — Start both servers in parallel

## Database
- SQLite file: `backend/api-interceptor.sqlite`
- Logs and endpoints are persisted automatically

## License
MIT
