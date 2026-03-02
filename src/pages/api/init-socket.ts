import { NextApiRequest, NextApiResponse } from 'next';
import { Server } from 'socket.io';
import { registerSocketEvents } from '../../lib/socket-handler';

export const config = {
    api: {
        bodyParser: false,
    },
};

const SocketHandler = (req: NextApiRequest, res: any) => {
    if (res.socket.server.io) {
        console.log('Socket is already running');
        res.end();
        return;
    }

    console.log('Socket is initializing');
    const io = new Server(res.socket.server, {
        path: '/api/socket',
        addTrailingSlash: false,
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
    });

    res.socket.server.io = io;
    registerSocketEvents(io);
    res.status(200).json({ success: true, message: 'Socket server initialized' });
};

export default SocketHandler;
