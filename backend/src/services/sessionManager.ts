/**
 * Interview Session Manager
 * Tracks interview state, question history, and difficulty progression
 */
import { v4 as uuidv4 } from 'uuid';


export type Difficulty = 'easy' | 'medium' | 'hard';

export function getLowerDifficulty(current: Difficulty): Difficulty {
    if (current === 'hard') return 'medium';
    if (current === 'medium') return 'easy';
    return 'easy';
}


export interface QuestionRecord {
    id: number;
    type: 'video' | 'code';
    text: string;
    title?: string;
    difficulty: Difficulty;
    starterCode?: string;
    language?: string;
    answer?: string;
    skipped?: boolean;
    evaluation?: {
        score: number;
        nextDifficulty: Difficulty;
        strengths: string[];
        weaknesses: string[];
        brief: string;
    };
    codeReview?: {
        score: number;
        correctness: boolean;
        timeComplexity: string;
        spaceComplexity: string;
        strengths: string[];
        issues: string[];
        brief: string;
    };
}

export interface InterviewSession {
    id: string;
    role: string;
    company: string;
    currentDifficulty: Difficulty;
    currentQuestionIndex: number;
    totalVideoQuestions: number;
    questions: QuestionRecord[];
    startedAt: string;
    completedAt?: string;
    analysis?: Record<string, unknown>;
}

// In-memory session store
const sessions = new Map<string, InterviewSession>();

export function createSession(role: string, company: string): InterviewSession {
    const session: InterviewSession = {
        id: uuidv4(),
        role,
        company,
        currentDifficulty: 'medium',
        currentQuestionIndex: 0,
        totalVideoQuestions: 3,
        questions: [],
        startedAt: new Date().toISOString(),
    };

    sessions.set(session.id, session);
    console.log(`📝 Session created: ${session.id} (${role} @ ${company})`);
    return session;
}

export function getSession(sessionId: string): InterviewSession | undefined {
    return sessions.get(sessionId);
}

export function addQuestion(sessionId: string, question: Omit<QuestionRecord, 'id'>): QuestionRecord {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const record: QuestionRecord = {
        ...question,
        id: session.questions.length + 1,
    };

    session.questions.push(record);
    session.currentQuestionIndex = session.questions.length;
    sessions.set(sessionId, session);

    return record;
}

export function recordAnswer(sessionId: string, questionId: number, answer: string, skipped: boolean = false): void {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const question = session.questions.find(q => q.id === questionId);
    if (!question) throw new Error(`Question ${questionId} not found in session`);

    question.answer = answer;
    question.skipped = skipped;
    sessions.set(sessionId, session);
}

export function recordEvaluation(
    sessionId: string,
    questionId: number,
    evaluation: QuestionRecord['evaluation']
): void {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const question = session.questions.find(q => q.id === questionId);
    if (!question) throw new Error(`Question ${questionId} not found`);

    question.evaluation = evaluation;

    // Update session difficulty for next question
    if (evaluation) {
        session.currentDifficulty = evaluation.nextDifficulty;
    }

    sessions.set(sessionId, session);
}

export function recordCodeReview(
    sessionId: string,
    questionId: number,
    review: QuestionRecord['codeReview']
): void {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const question = session.questions.find(q => q.id === questionId);
    if (!question) throw new Error(`Question ${questionId} not found`);

    question.codeReview = review;
    sessions.set(sessionId, session);
}

export function completeSession(sessionId: string, analysis: Record<string, unknown>): void {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    session.completedAt = new Date().toISOString();
    session.analysis = analysis;
    sessions.set(sessionId, session);
}

/**
 * Update the session with new data.
 * This is used when an agent returns an updated session object.
 */
export function updateSession(sessionId: string, updates: Partial<InterviewSession>): InterviewSession {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    // Merge updates into the session
    // We do a shallow merge for top-level properties
    const updatedSession = { ...session, ...updates };

    // Ensure ID and immutable properties are not overwritten (unless we really want to, but safety first)
    updatedSession.id = session.id;

    // Sanitize questions: Ensure they all have IDs
    if (updatedSession.questions) {
        updatedSession.questions = updatedSession.questions.map((q, index) => ({
            ...q,
            id: q.id || (index + 1),
        }));
    }

    sessions.set(sessionId, updatedSession);
    return updatedSession;
}

/**
 * Build a context string summarizing all previous Q&A for the interviewer
 */
export function buildInterviewContext(session: InterviewSession): string {
    const previousTitles = session.questions.map(q => `"${q.title || q.text.substring(0, 50)}..."`).join(', ');

    let context = `PREVIOUSLY ASKED QUESTIONS (DO NOT REPEAT): ${previousTitles}\n\n`;
    context += `INTERVIEW HISTORY:\n`;

    if (session.questions.length === 0) return context + 'No previous questions yet.';

    context += session.questions.map((q, i) => {
        let ctx = `Q${i + 1} [${q.difficulty}]: ${q.text}\n`;
        if (q.skipped) {
            ctx += `Status: SKIPPED (Candidate passed)\n`;
        } else if (q.answer) {
            ctx += `Answer: ${q.answer}\n`;
        }
        if (q.evaluation) {
            ctx += `Score: ${q.evaluation.score}/100 | ${q.evaluation.brief}\n`;
        }
        return ctx;
    }).join('\n');

    return context;
}
