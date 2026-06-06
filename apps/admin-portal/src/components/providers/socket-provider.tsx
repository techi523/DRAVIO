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

/**
 * SocketProvider connects to the DRAVIO gateway (port 8080) instead of
 * the admin-service directly. The gateway handles JWT auth for Socket.io.
 * SECURITY FIX: previously connected unauthenticated to port 3008.
 */
export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [systemHealth, setSystemHealth] = useState(null);

    useEffect(() => {
        // Use the GATEWAY url — it proxies to admin-service and handles JWT auth
        const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://127.0.0.1:8080';

        // TODO: In production, retrieve this token from a secure admin session store
        // For now, retrieve from localStorage (set during admin login)
        const adminToken = typeof window !== 'undefined'
            ? localStorage.getItem('dravio_admin_token') || ''
            : '';

        const socketInstance = io(gatewayUrl, {
            auth: { token: adminToken },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 3000,
        });

        socketInstance.on('connect', () => {
            console.log('[admin] Connected to DRAVIO gateway');
            setIsConnected(true);
        });

        socketInstance.on('disconnect', (reason: string) => {
            console.log('[admin] Disconnected from gateway:', reason);
            setIsConnected(false);
        });

        socketInstance.on('connect_error', (err: Error) => {
            console.warn('[admin] Socket connection error:', err.message);
            setIsConnected(false);
        });

        socketInstance.on('system_health', (data: any) => {
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
