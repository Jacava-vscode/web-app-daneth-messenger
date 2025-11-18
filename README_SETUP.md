**Daneth Messenger — Setup & Run (Local)**

This repository contains a minimal starter scaffold for a full-stack chat app with:
- `server/` — Node.js + Express + Socket.IO + MongoDB (models and basic routes)
- `client/` — Vite + React client that connects via Socket.IO

Quick steps to run locally:

1) Server

 - Create `.env` in `server/` (copy `.env.example`) and set `MONGODB_URI`, `JWT_SECRET`, `ADMIN_KEY`.
 - Install and start:

```powershell
Set-Location 'D:\Daneth_Project\full-stack-web-app-mobile-daneth-messenger\server'
npm install
npm run dev
```

2) Client

 - (Optional) configure `VITE_SERVER_URL` in `.env` inside `client/` to point to your server (default: http://localhost:5000).
 - Install and start:

```powershell
Set-Location 'D:\Daneth_Project\full-stack-web-app-mobile-daneth-messenger\client'
npm install
npm run dev
```

The client will connect to `http://localhost:5000` by default. You can open the Vite preview URL to use the messenger UI.

Notes & next steps:
- This scaffold is intentionally minimal so you can iterate on UI and 3D animations. Consider adding `GSAP` or building Three.js scenes with `@react-three/fiber` inside the `client/src`.
- Admin user creation: POST to `POST /api/admin/create-user` with header `x-admin-key: <ADMIN_KEY>` and body `{ username, password, isAdmin }`.
- Authentication route `POST /api/login` returns a JWT. The scaffold doesn't yet wire the token into the client UI.
