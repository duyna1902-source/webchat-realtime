import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { LogOut, User, MessageSquare, Shield, CheckCircle2, Wifi, WifiOff } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { isConnected, isConnecting } = useSocket();

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Web Chat Real-Time</h1>
            <p className="text-xs text-gray-500">Day 1 • Auth Tracer Bullet</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Socket Connection Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border">
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700 flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" /> Socket Connected
                </span>
              </>
            ) : isConnecting ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-700">Connecting...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-rose-700 flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5" /> Disconnected
                </span>
              </>
            )}
          </div>

          {/* User pill & Logout button */}
          <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm flex items-center justify-center border border-indigo-200">
                {currentUser.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-gray-800 leading-none">{currentUser.username}</p>
                <p className="text-xs text-gray-500 mt-0.5">{currentUser.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-medium"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Welcome Hero Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-medium text-indigo-100 mb-4">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>Full Stack Auth Tracer Bullet Verified</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome, {currentUser.username}!
            </h2>
            <p className="text-indigo-100 text-sm mt-2 leading-relaxed">
              Your authentication session is active, JWT tokens are securely persisted, and your Socket.io real-time connection has completed handshake authentication.
            </p>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">User Identity</h3>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500 text-xs font-medium">User ID</dt>
                <dd className="font-mono text-xs text-gray-800 break-all">{currentUser.id}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium">Username</dt>
                <dd className="font-medium text-gray-800">@{currentUser.username}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium">Email</dt>
                <dd className="font-medium text-gray-800">{currentUser.email}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Security & Session</h3>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500 text-xs font-medium">Auth Mechanism</dt>
                <dd className="font-medium text-gray-800">JWT (HS256) & bcrypt Hash</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium">Storage Location</dt>
                <dd className="font-medium text-gray-800">Browser localStorage</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium">Database Backend</dt>
                <dd className="font-medium text-gray-800">PostgreSQL (Prisma Unified Schema)</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Wifi className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Socket.io Transport</h3>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500 text-xs font-medium">Handshake Auth</dt>
                <dd className="font-medium text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Validated (`io.use`)
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium">Connection State</dt>
                <dd className="font-medium text-gray-800">
                  {isConnected ? 'Active & Receiving' : isConnecting ? 'Connecting' : 'Idle'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs font-medium">Next Ticket</dt>
                <dd className="font-medium text-indigo-600">02: 1-1 Direct Chat & History</dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
};
