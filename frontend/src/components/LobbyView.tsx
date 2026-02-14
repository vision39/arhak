import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Video,
    Mic,
    MicOff,
    VideoOff,
    RefreshCw,
    CheckCircle2,
    Clock,
} from 'lucide-react';
import { INTERVIEW_DATA } from '../data/questions';

interface LobbyViewProps {
    onJoin: () => void;
}

const LobbyView: React.FC<LobbyViewProps> = ({ onJoin }) => {
    const [micActive, setMicActive] = useState<boolean>(false);
    const [camActive, setCamActive] = useState<boolean>(false);
    const [isJoining, setIsJoining] = useState<boolean>(false);
    const [micLevel, setMicLevel] = useState<number>(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number>(0);

    // Start/stop camera based on camActive state
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error('Failed to access camera:', err);
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    useEffect(() => {
        if (camActive) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => {
            stopCamera();
        };
    }, [camActive, startCamera, stopCamera]);

    // Mic audio level analyser
    const startMic = useCallback(async () => {
        try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = micStream;

            const audioCtx = new AudioContext();
            audioCtxRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(micStream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const tick = () => {
                analyser.getByteFrequencyData(dataArray);
                // Average volume across all frequency bins
                const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
                // Normalize to 0-100
                setMicLevel(Math.min(100, (avg / 128) * 100));
                animFrameRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (err) {
            console.error('Failed to access microphone:', err);
        }
    }, []);

    const stopMic = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = 0;
        }
        if (audioCtxRef.current) {
            audioCtxRef.current.close();
            audioCtxRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }
        analyserRef.current = null;
        setMicLevel(0);
    }, []);

    useEffect(() => {
        if (micActive) {
            startMic();
        } else {
            stopMic();
        }
        return () => {
            stopMic();
        };
    }, [micActive, startMic, stopMic]);

    const handleJoinAttempt = () => {
        setIsJoining(true);
        setTimeout(() => {
            onJoin();
        }, 1200);
    };

    return (
        <div className="max-w-4xl mx-auto pt-8 pb-12 px-6 animate-in fade-in slide-in-from-bottom-8 duration-700 h-full overflow-y-auto custom-scrollbar">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Ready for your interview, Alex?</h1>
                <p className="text-slate-500">Please check your audio and video settings before joining.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Left: Media Preview */}
                <div className="space-y-4">
                    <div>
                        <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 shadow-xl flex items-center justify-center group">
                            {camActive ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="absolute inset-0 w-full h-full object-cover mirror-video"
                                    style={{ transform: 'scaleX(-1)' }}
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-center px-6">
                                    <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-1">
                                        <VideoOff className="w-7 h-7 text-red-500" />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700">Camera is mandatory</span>
                                    <span className="text-xs text-slate-400">Please turn on your camera to proceed with the interview</span>
                                </div>
                            )}
                        </div>

                        {/* Mic level bar — shown below the preview */}
                        {micActive && (
                            <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-75"
                                    style={{
                                        width: `${micLevel}%`,
                                        background: micLevel > 60
                                            ? 'linear-gradient(90deg, #6366f1, #ef4444)'
                                            : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => setMicActive(!micActive)}
                            className={`p-4 rounded-xl border transition-all ${micActive ? 'bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50' : 'bg-red-50 border-red-200 text-red-500'}`}
                        >
                            {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={() => setCamActive(!camActive)}
                            className={`p-4 rounded-xl border transition-all ${camActive ? 'bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50' : 'bg-red-50 border-red-200 text-red-500'}`}
                        >
                            {camActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Right: Session Info */}
                <div className="flex flex-col justify-center space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm text-indigo-600 font-bold uppercase tracking-wider mb-1">Up Next</p>
                                <h2 className="text-xl font-bold text-slate-900">{INTERVIEW_DATA.role}</h2>
                                <p className="text-slate-500">{INTERVIEW_DATA.company}</p>
                            </div>
                            <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xl">
                                N
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-3 text-slate-600">
                                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                                <span>Interviewer: {INTERVIEW_DATA.interviewer}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <span>Duration: {INTERVIEW_DATA.duration}</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleJoinAttempt}
                        disabled={isJoining}
                        className={`w-full py-4 font-bold rounded-xl shadow-lg transform transition-all active:translate-y-0 flex items-center justify-center gap-2 ${isJoining
                            ? 'bg-slate-100 text-slate-400 cursor-wait shadow-none'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:-translate-y-1 shadow-indigo-500/25'
                            }`}
                    >
                        {isJoining ? (
                            <>
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            "Start Interview"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LobbyView;
