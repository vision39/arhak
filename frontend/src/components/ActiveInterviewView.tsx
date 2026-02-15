import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Mic,
    MicOff,

    Code2,
    LogOut,
    ChevronRight,
    Cpu,
    MessageSquare,
    Loader2,
} from 'lucide-react';
import { startInterview, submitAnswer } from '../services/api';

// TypeScript declarations for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition: new () => SpeechRecognitionInstance;
    }
}

interface DynamicQuestion {
    id: number;
    type: 'video' | 'code';
    text: string;
    title?: string;
    difficulty: string;
    starterCode?: string;
    language?: string;
}

interface ActiveInterviewViewProps {
    onLeave: () => void;
    onComplete: () => void;
    startIndex?: number;
}

const ActiveInterviewView: React.FC<ActiveInterviewViewProps> = ({ onLeave, onComplete }) => {
    const navigate = useNavigate();

    // Session & question state
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<DynamicQuestion | null>(null);
    const [questionHistory, setQuestionHistory] = useState<DynamicQuestion[]>([]);
    const [totalQuestions, setTotalQuestions] = useState(4);
    const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Connecting to AI Interviewer...');

    // Interview state
    const [status, setStatus] = useState<'loading' | 'countdown' | 'recording' | 'coding'>('loading');
    const [timeLeft, setTimeLeft] = useState<number>(5);
    const [recordingDuration, setRecordingDuration] = useState<number>(0);

    const [micEnabled, setMicEnabled] = useState<boolean>(true);

    // Transcription state
    const [transcript, setTranscript] = useState<string>('');
    const [interimTranscript, setInterimTranscript] = useState<string>('');
    const [allTranscripts, setAllTranscripts] = useState<Record<number, string>>({});

    const streamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const transcriptRef = useRef<HTMLDivElement>(null);
    const recordingStatusRef = useRef<string>(status);

    // Sync ref with status state
    useEffect(() => {
        recordingStatusRef.current = status;
    }, [status]);


    // ─── Camera & Mic ───────────────────────────────────

    const stopMicrophone = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            streamRef.current = null;
        }
    };

    const startMicrophone = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true,
            });
            streamRef.current = stream;
        } catch (err) {
            console.error('Failed to access microphone:', err);
        }
    };

    // ─── Speech Recognition ─────────────────────────────

    const startRecognition = () => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            console.warn('SpeechRecognition not supported in this browser');
            return;
        }

        if (recognitionRef.current) {
            recognitionRef.current.abort();
            recognitionRef.current = null;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let final = '';
            let interim = '';

            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }

            setTranscript(final.trim());
            setInterimTranscript(interim);
        };

        recognition.onerror = (event: Event) => {
            console.error('Speech recognition error:', event);
        };

        recognition.onend = () => {
            // If the user stopped speaking for a while, the browser might stop the recognition.
            // We immediately restart it if we are still supposed to be recording.
            if (recordingStatusRef.current === 'recording' && micEnabled) {
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Failed to restart recognition:', e);
                }
            }
        };

        try {
            recognition.start();
            recognitionRef.current = recognition;
        } catch (err) {
            console.error('Failed to start speech recognition:', err);
        }
    };

    const stopRecognition = () => {
        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.abort();
            recognitionRef.current = null;
        }
    };

    // ─── Initialize Interview (fetch first question) ────

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            try {
                // Start microphone only
                await startMicrophone();

                if (cancelled) {
                    stopMicrophone();
                    return;
                }

                // Start interview session with backend
                setLoadingMessage('AI Interviewer is preparing your first question...');
                const result = await startInterview();

                if (cancelled) return;

                setSessionId(result.sessionId);
                setCurrentQuestion(result.question);
                setQuestionHistory([result.question]);
                setTotalQuestions(result.totalQuestions);
                setIsLoadingQuestion(false);
                setStatus('countdown');
                setTimeLeft(5);

                // Store session ID in localStorage for completion page
                localStorage.setItem('interviewSessionId', result.sessionId);

            } catch (err) {
                console.error('Failed to start interview:', err);
                setLoadingMessage('Failed to connect to AI Interviewer. Please try again.');
                setIsLoadingQuestion(false);
            }
        };

        init();

        return () => {
            cancelled = true;
            stopRecognition();
            stopMicrophone();
        };
    }, []);

    // ─── Handle question type changes ───────────────────

    useEffect(() => {
        if (!currentQuestion) return;

        if (currentQuestion.type === 'code') {
            stopRecognition();
            if (transcript) {
                const updated = { ...allTranscripts, [currentQuestion.id]: transcript };
                setAllTranscripts(updated);
                localStorage.setItem('interviewTranscripts', JSON.stringify(updated));
            }
            // Save coding question data for the coding page
            localStorage.setItem('codingQuestion', JSON.stringify({
                ...currentQuestion,
                sessionId,
            }));
            stopMicrophone();
            navigate(`/coding?sessionId=${sessionId}&questionId=${currentQuestion.id}`);
        } else if (status !== 'loading') {
            setStatus('countdown');
            setTimeLeft(5);
            setRecordingDuration(0);
            setTranscript('');
            setInterimTranscript('');
        }
    }, [currentQuestion?.id]);

    // Start/stop recognition based on status and mic
    useEffect(() => {
        // Only start recognition if we are in the 'recording' phase AND mic is enabled.
        // This effectively disables it during 'loading' and 'countdown'.
        if (status === 'recording' && micEnabled) {
            startRecognition();
        } else {
            stopRecognition();
        }
    }, [status, micEnabled]);

    // Auto-scroll transcript
    useEffect(() => {
        if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [transcript, interimTranscript]);

    // Countdown Timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        if (status === 'countdown' && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (status === 'countdown' && timeLeft === 0) {
            setStatus('recording');
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status, timeLeft]);

    // Recording Timer
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        if (status === 'recording') {
            interval = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status]);

    // ─── Submit Answer & Get Next Question ──────────────

    const handleNext = async (skipped: boolean = false) => {
        if (!sessionId || !currentQuestion || isSubmitting) return;

        const currentFullTranscript = transcript + (interimTranscript ? ' ' + interimTranscript : '');
        const finalTranscript = skipped ? '' : (currentFullTranscript.trim() || 'No answer provided');

        // Save transcript (or empty if skipped)
        const updated = { ...allTranscripts, [currentQuestion.id]: finalTranscript };
        setAllTranscripts(updated);
        localStorage.setItem('interviewTranscripts', JSON.stringify(updated));

        stopRecognition();
        setIsSubmitting(true);
        setLoadingMessage(skipped ? 'Skipping question...' : 'AI is evaluating your answer...');

        try {
            const result = await submitAnswer(sessionId, currentQuestion.id, finalTranscript, skipped);

            if (result.nextQuestion) {
                setCurrentQuestion(result.nextQuestion);
                setQuestionHistory(prev => [...prev, result.nextQuestion!]);
                setRecordingDuration(0);
                setIsSubmitting(false);
                // countdown/recording will be set by the useEffect above
            } else {
                // No more questions — complete
                stopMicrophone();
                onComplete();
            }
        } catch (err) {
            console.error('Failed to submit answer:', err);
            setIsSubmitting(false);
            setLoadingMessage('Failed to get next question. Try again.');
        }
    };

    const handleLeave = () => {
        stopRecognition();
        stopMicrophone();
        onLeave();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const fullTranscript = transcript + (interimTranscript ? ' ' + interimTranscript : '');
    const hasTranscript = fullTranscript.trim().length >= 2;
    const currentQNumber = questionHistory.length;

    // ─── Loading State ──────────────────────────────────

    if (isLoadingQuestion || !currentQuestion) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] bg-slate-50">
                <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/25">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-semibold text-slate-900">{loadingMessage}</p>
                        <p className="text-sm text-slate-500 mt-1">This may take a few seconds...</p>
                    </div>
                    <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                            <div
                                key={i}
                                className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                                style={{ animationDelay: `${i * 150}ms` }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Submitting State (between questions) ───────────

    if (isSubmitting) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] bg-slate-50">
                <div className="flex flex-col items-center gap-6 animate-in fade-in duration-300">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-500/25">
                        <Cpu className="w-8 h-8 text-white animate-pulse" />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-semibold text-slate-900">{loadingMessage}</p>
                        <p className="text-sm text-slate-500 mt-1">Preparing the next question based on your answer...</p>
                    </div>
                    <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full animate-pulse" style={{ width: '70%' }} />
                    </div>
                </div>
            </div>
        );
    }

    // ─── Main Interview UI ──────────────────────────────

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden">

            {/* SECTION 1: Question & Controls Area */}
            <div className="flex-1 lg:w-1/2 p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 min-h-0 overflow-hidden animate-in slide-in-from-left duration-500 order-1 lg:order-1">

                {/* Progress Bar */}
                <div className="flex items-center gap-2 shrink-0">
                    {Array.from({ length: totalQuestions }).map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-1.5 lg:h-2 flex-1 rounded-full transition-all duration-300 ${idx < currentQNumber - 1 ? 'bg-indigo-600' :
                                idx === currentQNumber - 1 ? 'bg-indigo-600/50' : 'bg-slate-200'
                                }`}
                        />
                    ))}
                </div>

                {/* Dynamic Content Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 lg:p-6 shadow-sm flex-1 flex flex-col relative overflow-hidden shrink-0">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />

                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wider">
                                {currentQuestion.type === 'code' ? 'Coding Challenge' : `Question ${currentQNumber}/${totalQuestions}`}
                            </div>
                            {/* Difficulty badge */}
                            <div className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider border ${currentQuestion.difficulty === 'hard'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : currentQuestion.difficulty === 'easy'
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                    : 'bg-amber-50 text-amber-600 border-amber-200'
                                }`}>
                                {currentQuestion.difficulty}
                            </div>
                        </div>

                        {/* AI/Type Indicator */}
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                            {currentQuestion.type === 'code' ? <Cpu className="w-3 h-3 text-blue-500" /> : <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                            {currentQuestion.type === 'code' ? 'Interactive Environment' : 'AI Interviewer Active'}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0">
                        <h2 className="text-xl md:text-3xl font-medium text-slate-900 leading-snug mb-4">
                            {currentQuestion.text}
                        </h2>

                        {/* Video Question Status Area */}
                        <div className="mt-auto flex flex-col gap-3">
                            {status === 'countdown' ? (
                                <div className="flex flex-col gap-2">
                                    <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">Recording starts in</p>
                                    <div className="text-5xl lg:text-6xl font-bold text-indigo-600 tabular-nums">
                                        {timeLeft}<span className="text-2xl text-indigo-300">s</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Live Transcript Area */}
                                    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                                            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Transcript</span>
                                            {micEnabled && (
                                                <div className="flex items-center gap-1 ml-auto">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                    <span className="text-[10px] text-red-500 font-medium">LIVE</span>
                                                </div>
                                            )}
                                        </div>
                                        <div
                                            ref={transcriptRef}
                                            className="p-4 h-28 overflow-y-auto custom-scrollbar"
                                        >
                                            {fullTranscript ? (
                                                <p className="text-sm text-slate-700 leading-relaxed">
                                                    <span>{transcript}</span>
                                                    {interimTranscript && (
                                                        <span className="text-slate-400 italic"> {interimTranscript}</span>
                                                    )}
                                                </p>
                                            ) : (
                                                <p className="text-sm text-slate-400 italic">
                                                    {micEnabled ? 'Start speaking — your answer will appear here in real time...' : 'Microphone is muted. Enable it to see transcription.'}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Listening indicator */}
                                    <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <Mic className="w-4 h-4 text-indigo-600" />
                                        <span className="text-xs font-medium">{micEnabled ? 'Listening...' : 'Microphone muted'}</span>
                                        {micEnabled && (
                                            <div className="flex gap-1 ml-auto">
                                                {[1, 2, 3, 4, 5].map(i => (
                                                    <div key={i} className="w-1 bg-indigo-400 rounded-full animate-pulse" style={{ height: `${Math.random() * 16 + 4}px`, animationDelay: `${i * 0.1}s` }} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-4 h-16 lg:h-16 shrink-0">
                    <button
                        onClick={() => handleNext(true)}
                        disabled={status === 'countdown' || isSubmitting}
                        className={`flex items-center justify-center gap-2 border-2 rounded-2xl font-bold transition-all text-sm lg:text-base ${status === 'countdown' ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 active:scale-95'}`}
                    >
                        Pass
                    </button>
                    <button
                        onClick={() => handleNext(false)}
                        disabled={status === 'countdown' || isSubmitting || !hasTranscript}
                        className={`flex items-center justify-center gap-2 rounded-2xl font-bold shadow-lg transition-all group text-sm lg:text-base ${(status === 'countdown' || !hasTranscript) ? 'bg-indigo-300 text-white/70 shadow-none cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-95'}`}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                Evaluate Answer
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* SECTION 2: User Area — Dummy Image & Mic Controls */}
            <div className="h-48 lg:h-auto lg:w-1/2 bg-slate-900 shrink-0 relative order-2 lg:order-2 animate-in slide-in-from-right duration-500 border-t lg:border-t-0 lg:border-l border-slate-200">
                <div className="absolute inset-0 bg-slate-800 flex items-center justify-center overflow-hidden">
                    {/* Dummy User Image */}
                    <img
                        src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                        alt="User Avatar"
                        className="w-32 h-32 lg:w-48 lg:h-48 rounded-full bg-slate-700 p-2 shadow-2xl"
                    />

                    {status === 'recording' && (
                        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse shadow-lg">
                            <div className="w-2 h-2 bg-white rounded-full" />
                            REC {formatTime(recordingDuration)}
                        </div>
                    )}
                    {status === 'coding' && (
                        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-full shadow-lg">
                            <Code2 className="w-3 h-3" />
                            Coding Mode Active
                        </div>
                    )}
                </div>

                <div className="absolute top-4 left-4 z-20 flex gap-2">
                    <div className="px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full flex items-center gap-2 text-white text-xs font-medium border border-white/10">
                        <div className={`w-2 h-2 rounded-full bg-green-500`} />
                        You
                    </div>
                </div>

                <div className="absolute bottom-4 left-4 right-4 z-20">
                    <div className="bg-white/90 backdrop-blur-md rounded-xl p-3 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 text-xs lg:text-sm">
                                ME
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900 leading-tight">Candidate</p>
                                <p className="text-[10px] lg:text-xs text-slate-500">Audio Only Mode</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const newMic = !micEnabled;
                                    setMicEnabled(newMic);
                                    if (streamRef.current) {
                                        streamRef.current.getAudioTracks().forEach(t => {
                                            t.enabled = newMic;
                                        });
                                    }
                                }}
                                className={`p-2 rounded-lg transition-colors ${micEnabled ? 'text-slate-600 hover:bg-slate-100' : 'bg-red-100 text-red-500'}`}
                                title={micEnabled ? 'Mute Mic' : 'Unmute Mic'}
                            >
                                {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                            </button>
                            <div className="w-px h-6 bg-slate-200 mx-1" />
                            <button
                                onClick={handleLeave}
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                title="Quit Interview"
                            >
                                <LogOut className="w-4 h-4 lg:w-5 lg:h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ActiveInterviewView;
