import React from 'react';
import { FileCode, RefreshCw, Play } from 'lucide-react';

interface CodeEditorProps {
    code: string;
    setCode: (code: string) => void;
    isRunning: boolean;
    onRun: () => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ code, setCode, isRunning, onRun }) => {
    return (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium text-slate-400">solution.js</span>
                </div>
                <button
                    onClick={onRun}
                    disabled={isRunning}
                    className="flex items-center gap-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors disabled:opacity-50"
                >
                    {isRunning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Run Code
                </button>
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative font-mono text-sm">
                <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full h-full bg-slate-900 text-slate-300 p-4 resize-none focus:outline-none custom-scrollbar leading-relaxed"
                    spellCheck="false"
                />
            </div>
        </div>
    );
};

export default CodeEditor;
