# CodeSync — Collaborative Code Editor

A real-time collaborative code editor with multi-language support and Docker-powered execution.

---

## Features

- **Real-time collaboration** — Multiple users in a room, live code sync via Socket.io
- **6-digit Room IDs** — Generate or share a room code to start collaborating instantly
- **Docker execution** — Isolated, sandboxed code execution per language
- **Monaco Editor** — Same editor engine as VS Code
- **Dynamic I/O panel** — Reposition Input/Output panel to Left / Right / Top / Bottom
- **Live user list** — See who's online in the room
- **Code save & download** — Snapshot to PostgreSQL or download as a file
- **Multi-theme** — Dark, Light, High Contrast

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript |
| Editor | Monaco Editor |
| Styling | Tailwind CSS, Radix UI |
| Database | PostgreSQL (Neon), Prisma 5 |
| Real-time | Socket.io 4 |
| Execution | Docker containers |
| Server | Express 5 + custom Node.js server |

---

## Supported Languages

| Language | Docker Image |
|----------|-------------|
| JavaScript | `node:18-alpine` |
| Python | `python:3.11-alpine` |
| Java | `eclipse-temurin:17-jdk-alpine` |
| C++ | `gcc:latest` |
| C | `gcc:latest` |

---

## Local Development

### Prerequisites

- Node.js 18+
- Docker (for code execution)
- PostgreSQL — [Neon](https://neon.tech) (free)

### Setup

```bash
# 1. Clone
git clone <repo-url>
cd collaborative-code-editor

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env     # then fill in your values

# 4. Setup database
npx prisma generate
npx prisma db push

# 5. Run
npm run dev
```

Open `http://localhost:3000`

### Environment Variables (local)

```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_RENDER_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
```

---

## Deployment — Vercel + Render (Split)

This project uses a split deployment strategy:

| Platform | What runs |
|----------|-----------|
| **Vercel** | Next.js UI + `/api/rooms` + `/api/code/save` |
| **Render** | `server.js` — Socket.io + `/api/execute` (Docker) |

### 1. Deploy to Render (first)

1. Push repo to GitHub
2. [render.com](https://render.com) → **New Web Service** → select repo
3. Configure:
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
4. Add environment variables:
   ```
   NODE_ENV=production
   DATABASE_URL=<your-neon-url>
   VERCEL_APP_URL=https://your-app.vercel.app
   ```
5. Deploy → copy the URL (e.g. `https://your-app.onrender.com`)

### 2. Deploy to Vercel (after Render)

1. [vercel.com](https://vercel.com) → **New Project** → same repo
2. Add environment variables:
   ```
   DATABASE_URL=<your-neon-url>
   NEXT_PUBLIC_RENDER_URL=https://your-app.onrender.com
   ```
3. Deploy

---

## Project Structure

```
collaborative-code-editor/
├── app/
│   ├── api/
│   │   ├── rooms/           # Room create/join (Vercel)
│   │   ├── code/save/       # Code snapshot (Vercel)
│   │   └── execute/         # Docker execution (local only)
│   ├── editor/              # Editor page
│   ├── page.tsx             # Landing page
│   └── globals.css
├── components/
│   ├── ui/                  # Radix UI components
│   └── CodeEditor.tsx       # Main editor + Socket.io client
├── lib/
│   ├── prisma.ts
│   ├── utils.ts
│   └── docker-executor.ts   # Routes execution to Render
├── prisma/
│   └── schema.prisma
├── server.js                # Express + Socket.io + Docker (Render)
├── vercel.json              # Vercel build config
└── package.json
```

---

**Built with Next.js · Socket.io · PostgreSQL · Docker**
# Collaborative-code-editor
