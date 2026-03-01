'use strict';

const express = require('express');
const { Server: SocketServer } = require('socket.io');
const cors = require('cors');
const next = require('next');
const { spawn } = require('child_process');
const { writeFileSync, mkdirSync, rmSync } = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.PORT || '3000', 10);
const IS_DEV = process.env.NODE_ENV !== 'production';
const VERCEL_URL = process.env.VERCEL_APP_URL || '*';

// Use 0.0.0.0 to be accessible everywhere locally
const hostname = '0.0.0.0';
const nextApp = next({ dev: IS_DEV, hostname, port: PORT });

// State management
const roomUsers = new Map();
const roomState = new Map();

function getRoomState(roomId) {
    if (!roomState.has(roomId)) roomState.set(roomId, {});
    return roomState.get(roomId);
}

function registerSocketEvents(io) {
    io.on('connection', (socket) => {
        console.log(`[socket] New connection: ${socket.id}`);
        let currentRoom = null;
        let currentUsername = null;

        socket.on('join-room', ({ roomId: rawRoomId, username }) => {
            const roomId = String(rawRoomId || '').trim();
            currentRoom = roomId;
            currentUsername = username;

            socket.join(roomId);

            if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
            roomUsers.get(roomId).set(socket.id, username);

            const users = [...roomUsers.get(roomId).values()];
            io.to(roomId).emit('users-update', users);

            if (roomState.has(roomId)) {
                socket.emit('room-state', roomState.get(roomId));
            }

            console.log(`[join]  "${username}" → room "${roomId}"  (${users.length} online, users: ${users.join(', ')})`);
        });

        socket.on('code-change', ({ roomId, code }) => {
            const rId = String(roomId || '').trim();
            getRoomState(rId).code = code;
            socket.to(rId).emit('code-change', { code });
        });

        socket.on('language-change', ({ roomId, language, code }) => {
            const rId = String(roomId || '').trim();
            Object.assign(getRoomState(rId), { language, code });
            socket.to(rId).emit('language-change', { language, code });
        });

        socket.on('input-change', ({ roomId, input }) => {
            const rId = String(roomId || '').trim();
            getRoomState(rId).input = input;
            socket.to(rId).emit('input-change', { input });
        });

        socket.on('execution-start', ({ roomId }) => {
            const rId = String(roomId || '').trim();
            socket.to(rId).emit('execution-start');
        });

        socket.on('execution-result', ({ roomId, output, error, executionTime }) => {
            const rId = String(roomId || '').trim();
            Object.assign(getRoomState(rId), { output, error, executionTime });
            socket.to(rId).emit('execution-result', { output, error, executionTime });
        });

        socket.on('disconnect', () => {
            if (!currentRoom || !roomUsers.has(currentRoom)) {
                console.log(`[socket] Disconnect without room: ${socket.id}`);
                return;
            }

            roomUsers.get(currentRoom).delete(socket.id);
            const remaining = [...roomUsers.get(currentRoom).values()];

            io.to(currentRoom).emit('users-update', remaining);

            console.log(`[leave] "${currentUsername}" ← room "${currentRoom}"  (${remaining.length} remaining)`);

            if (remaining.length === 0) {
                roomUsers.delete(currentRoom);
                roomState.delete(currentRoom);
                console.log(`[room]  Room "${currentRoom}" cleaned up (empty)`);
            }
        });
    });
}

async function start() {
    console.log('  ▲  [1/3] Preparing Next.js app...');
    try {
        await nextApp.prepare();
        console.log('  ▲  [2/3] Next.js app prepared successfully.');
    } catch (err) {
        console.error('  ✖  Failed to prepare Next.js app:', err);
        process.exit(1);
    }

    const handle = nextApp.getRequestHandler();
    const app = express();

    // Scoped middleware to avoid interfering with Next.js
    const corsMiddleware = cors({ origin: VERCEL_URL, methods: ['GET', 'POST', 'OPTIONS'] });

    // Handle CORS preflight globally
    app.use(corsMiddleware);

    app.get('/test-express', (req, res) => {
        res.send('Express is working with scoped CORS!');
    });

    app.post('/api/execute', express.json(), async (req, res) => {
        const tempDir = path.join(os.tmpdir(), "code-editor", uuidv4());
        try {
            const { code, language, input } = req.body;
            if (!code || !language) return res.status(400).json({ error: "Code and language are required" });

            mkdirSync(tempDir, { recursive: true });
            const inputFile = path.join(tempDir, "input.txt");
            writeFileSync(inputFile, typeof input === "string" ? input : "");

            let command = "";
            let args = [];

            switch (language.toLowerCase()) {
                case "cpp":
                    writeFileSync(path.join(tempDir, "main.cpp"), code);
                    command = "sh";
                    args = ["-c", `g++ "${path.join(tempDir, "main.cpp")}" -o "${path.join(tempDir, "output")}" 2>"${path.join(tempDir, "compile_error.txt")}" && "${path.join(tempDir, "output")}" <"${inputFile}" 2>&1 || (cat "${path.join(tempDir, "compile_error.txt")}" >&2 && exit 1)`];
                    break;
                case "c":
                    writeFileSync(path.join(tempDir, "main.c"), code);
                    command = "sh";
                    args = ["-c", `gcc "${path.join(tempDir, "main.c")}" -o "${path.join(tempDir, "output")}" 2>"${path.join(tempDir, "compile_error.txt")}" && "${path.join(tempDir, "output")}" <"${inputFile}" 2>&1 || (cat "${path.join(tempDir, "compile_error.txt")}" >&2 && exit 1)`];
                    break;
                case "python":
                    writeFileSync(path.join(tempDir, "main.py"), code);
                    command = "sh";
                    args = ["-c", `python3 "${path.join(tempDir, "main.py")}" <"${inputFile}" 2>&1`];
                    break;
                case "javascript":
                    writeFileSync(path.join(tempDir, "main.js"), code);
                    command = "sh";
                    args = ["-c", `node "${path.join(tempDir, "main.js")}" <"${inputFile}" 2>&1`];
                    break;
                case "java":
                    writeFileSync(path.join(tempDir, "Main.java"), code);
                    command = "sh";
                    args = ["-c", `javac "${path.join(tempDir, "Main.java")}" 1>"${path.join(tempDir, "compile_error.txt")}" 2>&1 && java -cp "${tempDir}" Main <"${inputFile}" 2>&1 || (cat "${path.join(tempDir, "compile_error.txt")}" >&2 && exit 1)`];
                    break;
                default:
                    return res.status(400).json({ error: `Unsupported language: ${language}` });
            }

            const child = spawn(command, args, { timeout: 30000 });
            let stdout = "", stderr = "";
            child.stdout.on("data", data => stdout += data.toString());
            child.stderr.on("data", data => stderr += data.toString());
            child.on("close", code => {
                setTimeout(() => { try { rmSync(tempDir, { recursive: true, force: true }); } catch (e) { } }, 1000);
                if (code !== 0) res.json({ output: stdout, error: stderr || `Process exited with code ${code}` });
                else res.json({ output: stdout || "(No output)" });
            });
            child.on("error", err => {
                try { rmSync(tempDir, { recursive: true, force: true }); } catch (e) { }
                res.json({ output: "", error: `Failed to execute: ${err.message}` });
            });
        } catch (error) {
            try { rmSync(tempDir, { recursive: true, force: true }); } catch { }
            res.status(500).json({ error: "Execution failed: " + error.message });
        }
    });

    // Delegate ALL other routes to Next.js
    app.all(/.*/, (req, res) => {
        return handle(req, res);
    });

    const server = app.listen(PORT, hostname, () => {
        console.log(`\n  ▲  [3/3] Socket.io + Next.js server ready`);
        console.log(`  ➜  Listening on http://${hostname}:${PORT}\n`);
    });

    const io = new SocketServer(server, {
        cors: { origin: VERCEL_URL, methods: ['GET', 'POST'] },
    });

    registerSocketEvents(io);

    // Debug: Check for available compilers
    const checkBinaries = ['node', 'python3', 'gcc', 'g++', 'java', 'javac'];
    console.log('[debug] Checking available binaries:');
    checkBinaries.forEach(bin => {
        const { execSync } = require('child_process');
        try {
            const path = execSync(`which ${bin}`).toString().trim();
            console.log(`  - ${bin}: ${path}`);
        } catch (e) {
            console.log(`  - ${bin}: NOT FOUND`);
        }
    });
}

start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
