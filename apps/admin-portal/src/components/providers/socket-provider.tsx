'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    systemHealth: any;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    systemHealth: null
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [systemHealth, setSystemHealth] = useState(null);

    useEffect(() => {
        // Assume admin-service is on port 3008
        const socketInstance = io('http://127.0.0.1:3008');

        socketInstance.on('connect', () => {
            console.log('Connected to Admin Control Center');
            setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
            console.log('Disconnected from Admin Control Center');
            setIsConnected(false);
        });

        socketInstance.on('system_health', (data) => {
            setSystemHealth(data);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected, systemHealth }}>
            {children}
        </SocketContext.Provider>
    );
};
