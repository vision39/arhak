import React, { useState, useEffect, useRef } from 'react';
import { Code2, Wifi, WifiOff } from 'lucide-react';

type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'offline';

const Header: React.FC = () => {
    const [connection, setConnection] = useState<ConnectionQuality>('good');
    const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const getConnectionQuality = (): ConnectionQuality => {
            if (!navigator.onLine) return 'offline';

            // Use Network Information API if available
            const nav = navigator as Navigator & {
                connection?: {
                    effectiveType?: string;
                    downlink?: number;
                    rtt?: number;
                };
            };

            if (nav.connection) {
                const { effectiveType, rtt } = nav.connection;

                if (effectiveType === '4g' && (rtt === undefined || rtt < 100)) return 'excellent';
                if (effectiveType === '4g' || effectiveType === '3g') return 'good';
                if (effectiveType === '2g') return 'fair';
                if (effectiveType === 'slow-2g') return 'fair';

                // Fallback to RTT
                if (rtt !== undefined) {
                    if (rtt < 100) return 'excellent';
                    if (rtt < 300) return 'good';
                    return 'fair';
                }
            }

            return navigator.onLine ? 'good' : 'offline';
        };

        // Initial check
        setConnection(getConnectionQuality());

        // Listen to online/offline events
        const handleOnline = () => setConnection(getConnectionQuality());
        const handleOffline = () => setConnection('offline');

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Listen to Network Information API changes
        const nav = navigator as Navigator & {
            connection?: EventTarget & {
                addEventListener: (type: string, listener: () => void) => void;
                removeEventListener: (type: string, listener: () => void) => void;
            };
        };

        const handleConnectionChange = () => setConnection(getConnectionQuality());

        if (nav.connection) {
            nav.connection.addEventListener('change', handleConnectionChange);
        }

        // Periodic check every 10s
        pingIntervalRef.current = setInterval(() => {
            setConnection(getConnectionQuality());
        }, 10000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (nav.connection) {
                nav.connection.removeEventListener('change', handleConnectionChange);
            }
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
        };
    }, []);

    const connectionConfig = {
        excellent: {
            label: 'Excellent Connection',
            dotColor: 'bg-emerald-500',
            iconColor: 'text-emerald-500',
            bgColor: 'bg-emerald-50 border-emerald-200',
            textColor: 'text-emerald-700',
        },
        good: {
            label: 'Stable Connection',
            dotColor: 'bg-emerald-500',
            iconColor: 'text-emerald-500',
            bgColor: 'bg-slate-100 border-slate-200',
            textColor: 'text-slate-600',
        },
        fair: {
            label: 'Weak Connection',
            dotColor: 'bg-amber-500 animate-pulse',
            iconColor: 'text-amber-500',
            bgColor: 'bg-amber-50 border-amber-200',
            textColor: 'text-amber-700',
        },
        offline: {
            label: 'No Connection',
            dotColor: 'bg-red-500 animate-pulse',
            iconColor: 'text-red-500',
            bgColor: 'bg-red-50 border-red-200',
            textColor: 'text-red-700',
        },
    };

    const config = connectionConfig[connection];

    return (
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50 shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Code2 className="text-white w-5 h-5" />
                </div>
                <span className="text-lg font-bold text-slate-900">
                    Nexus<span className="font-light text-slate-500">Candidate</span>
                </span>
            </div>
            <div className="flex items-center gap-4">
                <div className={`hidden md:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors duration-300 ${config.bgColor} ${config.textColor}`}>
                    <div className="relative">
                        {connection === 'offline' ? (
                            <WifiOff className={`w-3 h-3 ${config.iconColor}`} />
                        ) : (
                            <Wifi className={`w-3 h-3 ${config.iconColor}`} />
                        )}
                        <div className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                    </div>
                    <span className="font-medium">{config.label}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 border border-slate-300">
                    AR
                </div>
            </div>
        </header>
    );
};

export default Header;
