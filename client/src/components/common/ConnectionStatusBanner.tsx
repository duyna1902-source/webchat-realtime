import React from 'react';
import { useSocket } from '../../context/SocketContext';
import { Loader2, WifiOff } from 'lucide-react';

export const ConnectionStatusBanner: React.FC = () => {
  const { isConnected, isConnecting, connectionError } = useSocket();

  if (isConnected) return null;

  if (connectionError) {
    return (
      <div className="bg-red-500 text-white px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 shadow-sm animate-pulse">
        <WifiOff className="w-4 h-4" />
        <span>Failed to connect to real-time server: {connectionError}</span>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="bg-amber-500 text-white px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 shadow-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Connecting to server (Render free tier waking up, may take up to 45s)...</span>
      </div>
    );
  }

  return null;
};
