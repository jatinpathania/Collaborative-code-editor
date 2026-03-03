import { Server, Socket } from 'socket.io';
import { roomUsers, roomState, getRoomState } from './socket-state';

export function registerSocketEvents(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log(`[socket] New connection: ${socket.id}`);
        let currentRoom: string | null = null;
        let currentUsername: string | null = null;

        socket.on('join-room', ({ roomId: rawRoomId, username }) => {
            const roomId = String(rawRoomId || '').trim();
            currentRoom = roomId;
            currentUsername = username;

            socket.join(roomId);

            if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
            const usersInRoom = roomUsers.get(roomId)!;
            usersInRoom.set(socket.id, username);

            const users = Array.from(new Set(usersInRoom.values()));
            io.to(roomId).emit('users-update', users);

            if (roomState.has(roomId)) {
                socket.emit('room-state', roomState.get(roomId));
            }

            console.log(`[join]  "${username}" → room "${roomId}"  (${users.length} online)`);
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

        socket.on('user-speaking', ({ roomId, username, isSpeaking }) => {
            const rId = String(roomId || '').trim();
            io.to(rId).emit('user-speaking', { username, isSpeaking });
        });

        socket.on('webrtc-offer', ({ to, roomId, offer }) => {
            const rId = String(roomId || '').trim();
            io.to(rId).emit('webrtc-offer', { from: currentUsername, offer });
        });

        socket.on('webrtc-answer', ({ to, roomId, answer }) => {
            const rId = String(roomId || '').trim();
            io.to(rId).emit('webrtc-answer', { from: currentUsername, answer });
        });

        socket.on('webrtc-ice-candidate', ({ to, roomId, candidate }) => {
            const rId = String(roomId || '').trim();
            io.to(rId).emit('webrtc-ice-candidate', { from: currentUsername, candidate });
        });

        socket.on('disconnect', () => {
            if (!currentRoom || !roomUsers.has(currentRoom)) {
                console.log(`[socket] Disconnect without room: ${socket.id}`);
                return;
            }

            const usersInRoom = roomUsers.get(currentRoom)!;
            usersInRoom.delete(socket.id);
            const remaining = Array.from(new Set(usersInRoom.values()));

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
