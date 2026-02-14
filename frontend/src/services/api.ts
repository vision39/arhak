/**
 * Frontend API Service
 * Communicates with the interview backend
 */

const API_BASE = 'http://localhost:3001/api';

interface StartResponse {
    sessionId: string;
    question: {
        id: number;
        type: 'video' | 'code';
        text: string;
        title?: string;
        difficulty: string;
        starterCode?: string;
        language?: string;
    };
    totalQuestions: number;
    currentQuestion: number;
}

interface AnswerResponse {
    evaluation: {
        score: number;
        strengths: string[];
        weaknesses: string[];
        brief: string;
        nextDifficulty: string;
    };
    nextQuestion: {
        id: number;
        type: 'video' | 'code';
        text: string;
        title?: string;
        difficulty: string;
        starterCode?: string;
        language?: string;
    } | null;
    isLastVideoQuestion: boolean;
    currentQuestion: number;
    totalQuestions: number;
}

interface CodeReviewResponse {
    review: {
        score: number;
        correctness: boolean;
        timeComplexity: string;
        spaceComplexity: string;
        strengths: string[];
        issues: string[];
        brief: string;
    };
}

interface AnalysisResponse {
    analysis: {
        overallScore: number;
        totalTime: string;
        recommendation?: string;
        skills: Array<{ label: string; score: number }>;
        questionResults: Array<{
            id: number;
            title: string;
            type: string;
            score: number;
            status: string;
        }>;
        feedback: Array<{ type: string; text: string }>;
        summary?: string;
    };
}

export async function startInterview(
    role: string = 'Senior Frontend Engineer',
    company: string = 'Nebula Systems'
): Promise<StartResponse> {
    const res = await fetch(`${API_BASE}/interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, company }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start interview');
    }

    return res.json();
}

export async function submitAnswer(
    sessionId: string,
    questionId: number,
    transcript: string,
    skipped: boolean = false
): Promise<AnswerResponse> {
    const res = await fetch(`${API_BASE}/interview/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, questionId, transcript, skipped }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit answer');
    }

    return res.json();
}

export async function submitCode(
    sessionId: string,
    questionId: number,
    code: string,
    language: string = 'javascript'
): Promise<CodeReviewResponse> {
    const res = await fetch(`${API_BASE}/interview/submit-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, questionId, code, language }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit code');
    }

    return res.json();
}

export async function getAnalysis(sessionId: string): Promise<AnalysisResponse> {
    const res = await fetch(`${API_BASE}/interview/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to get analysis');
    }

    const data = await res.json();
    const raw = data.analysis || {};

    // Normalize skills: backend may send `skillScores` (object) or `skills` (array)
    let skills: Array<{ label: string; score: number }> = [];
    if (Array.isArray(raw.skills)) {
        skills = raw.skills.map((s: Record<string, unknown>) => ({
            label: (s.label || s.name || 'Skill') as string,
            score: Number(s.score) || 0,
        }));
    } else if (raw.skillScores && typeof raw.skillScores === 'object') {
        skills = Object.entries(raw.skillScores as Record<string, number>).map(([key, val]) => ({
            label: key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim(),
            score: Number(val) || 0,
        }));
    }

    // Normalize questionResults
    const getStatus = (score: number) => {
        if (score >= 85) return 'excellent';
        if (score >= 70) return 'good';
        if (score >= 50) return 'average';
        return 'poor';
    };

    let questionResults: Array<{ id: number; title: string; type: string; score: number; status: string }> = [];
    if (Array.isArray(raw.questionResults)) {
        questionResults = raw.questionResults.map((q: Record<string, unknown>, i: number) => ({
            id: Number(q.id ?? q.questionNumber ?? i + 1),
            title: (q.title || q.question || `Question ${i + 1}`) as string,
            type: (q.type || 'video') as string,
            score: Number(q.score) || 0,
            status: (q.status || getStatus(Number(q.score) || 0)) as string,
        }));
    }

    // Normalize feedback
    let feedback: Array<{ type: string; text: string }> = [];
    if (Array.isArray(raw.feedback)) {
        feedback = raw.feedback.map((f: Record<string, unknown>) => ({
            type: (f.type || 'strength') as string,
            text: (f.text || f.message || String(f)) as string,
        }));
    }

    return {
        analysis: {
            overallScore: Number(raw.overallScore) || 0,
            totalTime: (raw.totalTime || '—') as string,
            recommendation: raw.recommendation as string | undefined,
            skills,
            questionResults,
            feedback,
            summary: raw.summary as string | undefined,
        },
    };
}
