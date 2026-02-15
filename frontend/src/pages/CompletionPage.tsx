import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2,
    TrendingUp,
    Code2,
    MessageSquare,
    Lightbulb,
    Star,
    BarChart3,
    ArrowRight,
    Award,
    Clock,
    Zap,
    Target,
    FileCode,
    Loader2,
    Brain,
    AlertTriangle,
} from 'lucide-react';
import { getAnalysis } from '../services/api';

interface SkillScore {
    label: string;
    score: number;
}

interface FeedbackItem {
    type: string;
    text: string;
}

interface QuestionResult {
    id: number;
    title: string;
    type: string;
    score: number;
    status: string;
}

interface AnalysisData {
    overallScore: number;
    totalTime: string;
    recommendation?: string;
    skills: SkillScore[];
    questionResults: QuestionResult[];
    feedback: FeedbackItem[];
    summary?: string;
}

const skillColors = ['bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];

const CompletionPage: React.FC = () => {
    const navigate = useNavigate();
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);
    const [analysisStep, setAnalysisStep] = useState<number>(0);
    const [animatedScores, setAnimatedScores] = useState<boolean>(false);
    const [showDetails, setShowDetails] = useState<boolean>(false);
    const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const analysisSteps = [
        'Reviewing video responses...',
        'Evaluating code submission...',
        'Analyzing communication skills...',
        'Generating performance report...',
    ];

    // Fetch real analysis from backend
    useEffect(() => {
        const sessionId = localStorage.getItem('interviewSessionId');

        if (!sessionId) {
            setError('No interview session found. Please complete an interview first.');
            setIsAnalyzing(false);
            return;
        }

        // Step through analysis messages while API call is in progress
        const stepInterval = setInterval(() => {
            setAnalysisStep(prev => {
                if (prev < analysisSteps.length - 1) return prev + 1;
                return prev;
            });
        }, 1500);

        // Call the Analyst Agent via backend
        getAnalysis(sessionId)
            .then(response => {
                clearInterval(stepInterval);
                setAnalysisStep(analysisSteps.length - 1);
                console.log('Analysis Data:', JSON.stringify(response.analysis, null, 2));

                setAnalysisData(response.analysis);

                // Slight delay before revealing results for smooth transition
                setTimeout(() => {
                    setIsAnalyzing(false);
                }, 600);
            })
            .catch(err => {
                clearInterval(stepInterval);
                console.error('Analysis failed:', err);
                setError('Failed to generate analysis. The AI service may be unavailable.');
                setIsAnalyzing(false);
            });

        return () => {
            clearInterval(stepInterval);
        };
    }, []);

    // Animate scores after analysis completes
    useEffect(() => {
        if (!isAnalyzing && analysisData) {
            const t1 = setTimeout(() => setAnimatedScores(true), 400);
            const t2 = setTimeout(() => setShowDetails(true), 800);
            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
            };
        }
    }, [isAnalyzing, analysisData]);

    // Read submitted code from localStorage
    const submittedCodeData = (() => {
        try {
            const raw = localStorage.getItem('submittedCode');
            if (raw) return JSON.parse(raw) as { title: string; language: string; code: string };
        } catch { /* ignore */ }
        return null;
    })();

    // Read interview transcripts from localStorage
    const transcripts: Record<string, string> = (() => {
        try {
            const raw = localStorage.getItem('interviewTranscripts');
            if (raw) return JSON.parse(raw);
        } catch { /* ignore */ }
        return {};
    })();

    const getScoreColor = (score: number) => {
        if (score >= 85) return 'text-emerald-600';
        if (score >= 70) return 'text-amber-600';
        return 'text-red-500';
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'excellent': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'good': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'average': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'poor': return 'bg-red-50 text-red-700 border-red-200';
            default: return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    const getRecommendationStyle = (rec?: string) => {
        switch (rec) {
            case 'Strong Hire': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
            case 'Hire': return 'bg-green-100 text-green-800 border-green-300';
            case 'Maybe': return 'bg-amber-100 text-amber-800 border-amber-300';
            case 'No Hire': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-slate-100 text-slate-800 border-slate-300';
        }
    };

    // ─── Analyzing State ────────────────────────────────

    if (isAnalyzing) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50">
                <div className="text-center animate-in fade-in duration-500 max-w-md px-6">
                    <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                        <Brain className="w-10 h-10 text-indigo-600" />
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-3">Analyzing Your Interview</h1>
                    <p className="text-slate-500 mb-8">Our AI agents are reviewing your responses and code submission. This may take a moment...</p>

                    <div className="space-y-3 text-left">
                        {analysisSteps.map((step, idx) => (
                            <div
                                key={idx}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${idx < analysisStep
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : idx === analysisStep
                                        ? 'bg-indigo-50 border-indigo-200'
                                        : 'bg-slate-50 border-slate-100'
                                    }`}
                            >
                                {idx < analysisStep ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                ) : idx === analysisStep ? (
                                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
                                ) : (
                                    <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />
                                )}
                                <span className={`text-sm font-medium ${idx < analysisStep
                                    ? 'text-emerald-700'
                                    : idx === analysisStep
                                        ? 'text-indigo-700'
                                        : 'text-slate-400'
                                    }`}>{step}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Error State ────────────────────────────────────

    if (error || !analysisData) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50">
                <div className="text-center max-w-md px-6 animate-in fade-in duration-300">
                    <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
                        <AlertTriangle className="w-10 h-10 text-amber-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-3">Analysis Unavailable</h1>
                    <p className="text-slate-500 mb-6">{error || 'Something went wrong.'}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                    >
                        Return to Lobby
                    </button>
                </div>
            </div>
        );
    }

    // ─── Results View ───────────────────────────────────

    const { overallScore, totalTime, recommendation, skills, questionResults, feedback, summary } = analysisData;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50">
            <div className="max-w-5xl mx-auto py-10 px-6 animate-in fade-in slide-in-from-bottom-8 duration-700">

                {/* Header Section */}
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 animate-in zoom-in duration-500">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Interview Completed!</h1>
                    <p className="text-slate-500 max-w-lg mx-auto">
                        Here's your AI-generated analysis powered by our agent swarm.
                    </p>
                    {recommendation && (
                        <div className={`inline-block mt-4 px-4 py-1.5 text-sm font-bold rounded-full border ${getRecommendationStyle(recommendation)}`}>
                            {recommendation}
                        </div>
                    )}
                </div>

                {/* Score Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {/* Overall Score */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
                        <Award className="w-6 h-6 text-indigo-500 mx-auto mb-3" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Overall Score</p>
                        <div className={`text-5xl font-bold tabular-nums transition-all duration-1000 ${animatedScores ? getScoreColor(overallScore) : 'text-slate-200'}`}>
                            {animatedScores ? overallScore : 0}
                            <span className="text-lg text-slate-400">/100</span>
                        </div>
                    </div>

                    {/* Time Taken */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center">
                        <Clock className="w-6 h-6 text-blue-500 mx-auto mb-3" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Time Taken</p>
                        <div className="text-4xl font-bold text-slate-900 tabular-nums">{totalTime || '—'}</div>
                        <p className="text-xs text-slate-400 mt-1">interview duration</p>
                    </div>

                    {/* Questions Answered */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center">
                        <Target className="w-6 h-6 text-emerald-500 mx-auto mb-3" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Completed</p>
                        <div className="text-4xl font-bold text-slate-900">{questionResults.length}/{questionResults.length}</div>
                        <p className="text-xs text-slate-400 mt-1">all questions answered</p>
                    </div>
                </div>

                {/* Skills Breakdown + Feedback */}
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 transition-all duration-500 ${showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

                    {/* Skills Breakdown */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-5">
                            <BarChart3 className="w-5 h-5 text-indigo-500" />
                            <h2 className="text-lg font-bold text-slate-900">Skills Breakdown</h2>
                        </div>
                        <div className="space-y-4">
                            {skills.map((skill, idx) => (
                                <div key={idx}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-sm font-medium text-slate-700">{skill.label}</span>
                                        <span className={`text-sm font-bold tabular-nums ${getScoreColor(skill.score)}`}>{animatedScores ? skill.score : 0}%</span>
                                    </div>
                                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${skillColors[idx % skillColors.length]}`}
                                            style={{ width: animatedScores ? `${skill.score}%` : '0%', transitionDelay: `${idx * 100}ms` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Feedback */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-5">
                            <Lightbulb className="w-5 h-5 text-amber-500" />
                            <h2 className="text-lg font-bold text-slate-900">AI Feedback</h2>
                        </div>
                        <div className="space-y-3">
                            {feedback.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${item.type === 'strength'
                                        ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                                        : 'bg-amber-50/50 border-amber-100 text-amber-800'
                                        }`}
                                >
                                    {item.type === 'strength' ? (
                                        <Star className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                    ) : (
                                        <TrendingUp className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                    )}
                                    <span>{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* AI Summary */}
                {summary && (
                    <div className={`bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-6 shadow-sm mb-8 transition-all duration-500 delay-100 ${showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <div className="flex items-center gap-2 mb-3">
                            <Brain className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-lg font-bold text-slate-900">AI Summary</h2>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
                    </div>
                )}

                {/* Per-Question Results */}
                <div className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8 transition-all duration-500 delay-200 ${showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="flex items-center gap-2 mb-5">
                        <Zap className="w-5 h-5 text-violet-500" />
                        <h2 className="text-lg font-bold text-slate-900">Question-wise Performance</h2>
                    </div>
                    <div className="space-y-3">
                        {questionResults.map((q) => (
                            <div key={q.id} className="flex items-center gap-4 p-4 bg-slate-50/80 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${q.type === 'code' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {q.type === 'code' ? <Code2 className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">{q.title}</p>
                                    <p className="text-xs text-slate-400 capitalize">{q.type} question</p>
                                </div>
                                <span className={`px-3 py-1 text-xs font-bold rounded-full border capitalize ${getStatusBadge(q.status)}`}>
                                    {q.status}
                                </span>
                                <span className={`text-lg font-bold tabular-nums ${getScoreColor(q.score)}`}>
                                    {q.score}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Your Answers / Transcripts */}
                {Object.keys(transcripts).length > 0 && (
                    <div className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8 transition-all duration-500 delay-250 ${showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <div className="flex items-center gap-2 mb-5">
                            <MessageSquare className="w-5 h-5 text-indigo-500" />
                            <h2 className="text-lg font-bold text-slate-900">Your Answers (Transcribed)</h2>
                        </div>
                        <div className="space-y-4">
                            {Object.entries(transcripts).map(([qKey, text]) => {
                                const qId = parseInt(qKey, 10);
                                const q = questionResults.find(r => r.id === qId);
                                return (
                                    <div key={qKey} className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                                Q{qId}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-700">{q ? q.title : `Question ${qId}`}</span>
                                        </div>
                                        <div className="p-4">
                                            <p className="text-sm text-slate-600 leading-relaxed italic">"{text}"</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Submitted Code Section */}
                {submittedCodeData && (
                    <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm mb-8 overflow-hidden transition-all duration-500 delay-300 ${showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <div className="p-6 pb-4">
                            <div className="flex items-center gap-2 mb-1">
                                <FileCode className="w-5 h-5 text-blue-500" />
                                <h2 className="text-lg font-bold text-slate-900">Your Submitted Code</h2>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-sm text-slate-500">{submittedCodeData.title}</span>
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100 uppercase">
                                    {submittedCodeData.language}
                                </span>
                            </div>
                        </div>
                        <div className="bg-slate-950 border-t border-slate-200">
                            <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                                </div>
                                <span className="text-xs text-slate-500 font-medium">
                                    solution.{submittedCodeData.language === 'javascript' ? 'js' : submittedCodeData.language}
                                </span>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar">
                                <pre className="p-4 text-sm leading-relaxed">
                                    <code>
                                        {submittedCodeData.code.split('\n').map((line: string, idx: number) => (
                                            <div key={idx} className="flex">
                                                <span className="inline-block w-8 text-right mr-4 text-slate-600 select-none text-xs leading-relaxed">{idx + 1}</span>
                                                <span className="text-slate-300">{line || ' '}</span>
                                            </div>
                                        ))}
                                    </code>
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-center gap-4 pb-6">
                    <button
                        onClick={() => {
                            // Clear session data
                            localStorage.removeItem('interviewSessionId');
                            localStorage.removeItem('interviewTranscripts');
                            localStorage.removeItem('submittedCode');
                            localStorage.removeItem('codingQuestion');
                            navigate('/');
                        }}
                        className="px-8 py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg flex items-center gap-2"
                    >
                        Return to Lobby
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompletionPage;
