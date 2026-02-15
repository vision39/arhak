import React from 'react';
import { Code2 } from 'lucide-react';

const Header: React.FC = () => {
    return (
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50 shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Code2 className="text-white w-5 h-5" />
                </div>
                <span className="text-lg font-bold text-slate-900">
                    ArHak
                </span>
            </div>
            {/* Right side elements removed as requested */}
            <div className="flex items-center gap-4">
            </div>
        </header>
    );
};

export default Header;
