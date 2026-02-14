import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ChevronRight,
    Cpu,
    Terminal,
    FileCode,
    RefreshCw,
    Play,
    Clock,
    CheckCircle2,
    ArrowLeft,
    Lightbulb,
    Loader2,
} from 'lucide-react';
import { submitCode } from '../services/api';

interface CodingQuestionData {
    id: number;
    type: 'code';
    text: string;
    title?: string;
    difficulty: string;
    starterCode?: string;
    language?: string;
    sessionId?: string;
}

const CodingChallengePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const sessionId = searchParams.get('sessionId') || '';
    const questionId = parseInt(searchParams.get('questionId') || '0', 10);

    // Load question data from localStorage (saved by ActiveInterviewView)
    const [questionData, setQuestionData] = useState<CodingQuestionData | null>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('codingQuestion');
            if (raw) {
                const parsed = JSON.parse(raw) as CodingQuestionData;
                setQuestionData(parsed);
            }
        } catch {
            console.error('Failed to load coding question data');
        }
    }, []);

    const [code, setCode] = useState<string>('');
    const [consoleOutput, setConsoleOutput] = useState<string>('');
    const [isCodeRunning, setIsCodeRunning] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'description' | 'hints'>('description');
    const [showTestResults, setShowTestResults] = useState<boolean>(false);


    // Set starter code when question loads
    useEffect(() => {
        if (questionData?.starterCode) {
            setCode(questionData.starterCode);
        }
    }, [questionData]);

    // Start camera on mount


    if (!questionData) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-slate-50">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                    <p className="text-slate-500">Loading coding challenge...</p>
                </div>
            </div>
        );
    }

    const handleRunCode = () => {
        setIsCodeRunning(true);
        setConsoleOutput('');
        setShowTestResults(false);
        setTimeout(() => {
            setIsCodeRunning(false);
            try {
                // Try to actually run the code
                const logs: string[] = [];
                const originalLog = console.log;
                console.log = (...args: unknown[]) => {
                    logs.push(args.map(a => JSON.stringify(a)).join(' '));
                };
                try {
                    new Function(code)();
                } catch (e) {
                    logs.push(`Error: ${(e as Error).message}`);
                }
                console.log = originalLog;

                if (logs.length > 0) {
                    setConsoleOutput(logs.join('\n'));
                } else {
                    setConsoleOutput(`> Running "${questionData.title}"...\n> Code executed successfully (no output)`);
                }
            } catch {
                setConsoleOutput(`> Running tests for "${questionData.title}"...\n> Execution completed`);
            }
            setShowTestResults(true);
        }, 1000);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);

        // Save submitted code for analysis page
        localStorage.setItem('submittedCode', JSON.stringify({
            title: questionData.title || 'Coding Challenge',
            language: questionData.language || 'javascript',
            code: code,
        }));

        try {
            // Submit code to backend for AI review
            if (sessionId && questionId) {
                await submitCode(sessionId, questionId, code, questionData.language || 'javascript');
            }
        } catch (err) {
            console.error('Code review failed:', err);
        }

        // Navigate to completion
        navigate('/completed');
    };

    const handleBack = () => {
        navigate('/interview');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden animate-in fade-in duration-300">

            {/* Top Bar */}
            <div className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleBack}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                        title="Back to Interview"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-slate-200" />
                    <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-bold text-slate-900">Coding Challenge</span>
                    </div>
                    {questionData.difficulty && (
                        <div className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider border ${questionData.difficulty === 'hard'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : questionData.difficulty === 'easy'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-amber-50 text-amber-600 border-amber-200'
                            }`}>
                            {questionData.difficulty}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                        <Clock className="w-3 h-3" />
                        <span className="font-medium">{questionData.language || 'javascript'}</span>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                Submit Solution
                                <ChevronRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Content — Split View */}
            <div className="flex-1 flex min-h-0">

                {/* LEFT: Problem Description */}
                <div className="w-[42%] border-r border-slate-200 bg-white flex flex-col min-h-0">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 px-4 pt-2 gap-1 shrink-0">
                        <button
                            onClick={() => setActiveTab('description')}
                            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'description' ? 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Description
                        </button>
                        <button
                            onClick={() => setActiveTab('hints')}
                            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${activeTab === 'hints' ? 'text-amber-600 bg-amber-50 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Lightbulb className="w-3.5 h-3.5" />
                            Hints
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {activeTab === 'description' ? (
                            <div className="space-y-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white">
                                            <FileCode className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h1 className="text-xl font-bold text-slate-900">{questionData.title || 'Coding Challenge'}</h1>
                                            <span className="text-xs text-slate-500 font-medium">{(questionData.language || 'javascript').toUpperCase()}</span>
                                        </div>
                                    </div>
                                    <p className="text-slate-700 leading-relaxed text-[15px]">{questionData.text}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Lightbulb className="w-4 h-4 text-amber-600" />
                                        <span className="text-sm font-bold text-amber-800">Hint 1</span>
                                    </div>
                                    <p className="text-sm text-amber-700">Think about breaking down the problem into smaller steps. What's the simplest possible approach?</p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Lightbulb className="w-4 h-4 text-amber-600" />
                                        <span className="text-sm font-bold text-amber-800">Hint 2</span>
                                    </div>
                                    <p className="text-sm text-amber-700">Consider edge cases — empty inputs, single elements, and already-solved cases.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Code Editor + Console */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-900">

                    {/* Editor Toolbar */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                                <span className="font-medium">solution.{questionData.language === 'javascript' ? 'js' : questionData.language || 'js'}</span>
                            </div>
                        </div>
                        <button
                            onClick={handleRunCode}
                            disabled={isCodeRunning}
                            className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 shadow-md"
                        >
                            {isCodeRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            Run Code
                        </button>
                    </div>

                    {/* Code Editor */}
                    <div className="flex-1 relative font-mono text-sm min-h-0">
                        <textarea
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full h-full bg-slate-900 text-slate-300 p-4 resize-none focus:outline-none custom-scrollbar leading-relaxed"
                            spellCheck={false}
                            placeholder="Write your solution here..."
                        />
                    </div>

                    {/* Console */}
                    <div className="h-36 shrink-0 bg-slate-950 border-t border-slate-800 overflow-hidden flex flex-col">
                        <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                                <Terminal className="w-3.5 h-3.5" />
                                Console
                            </div>
                            {showTestResults && (
                                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Executed
                                </div>
                            )}
                        </div>
                        <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                            <div className="font-mono text-xs text-emerald-400 whitespace-pre-wrap">
                                {consoleOutput || <span className="text-slate-700 opacity-50">Click 'Run Code' to see output...</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Floating Camera Preview (PiP) */}
                {/* Floating User Avatar (PiP) */}
                <div className="fixed bottom-6 right-6 z-50 w-24 h-24 lg:w-32 lg:h-32 rounded-full overflow-hidden shadow-2xl border-4 border-white/20 bg-slate-800 group transition-all hover:scale-105">
                    <img
                        src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                        alt="User"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="text-[10px] text-white font-bold tracking-wide">YOU</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodingChallengePage;
