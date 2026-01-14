<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# UniFlow Monorepo

Frontend and backend have been split into separate folders for easier management:

```
/backend   -> API (Express + MongoDB)
/frontend  -> UI (React + Vite)
```

## Backend
```bash
cd backend
npm install
npm run dev    # nodemon
# or npm start for plain node
```
- Env file: `backend/.env` (points to MongoDB UniFlow_DB, port 5050).
- Serves built frontend from `../frontend/dist` when present.

## Frontend
```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
npm run build     # outputs to frontend/dist
```
- Localhost API base uses `http://localhost:5050`.

## Root scripts
Helper shortcuts:
```bash
npm run backend        # run backend dev
npm run backend:start  # run backend start
npm run frontend       # run frontend dev
npm run frontend:build # build frontend
```
