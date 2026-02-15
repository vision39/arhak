/**
 * Interview Routes
 * Orchestrates the 4-agent swarm for adaptive interviews
 */
import { Router, Request, Response } from 'express';
import { sendToAgent, sendContextToAgent, parseAgentJSON } from '../services/archestra.js';
import {
    createSession,
    getSession,
    addQuestion,
    recordAnswer,
    recordEvaluation,
    recordCodeReview,
    completeSession,
    updateSession,
    buildInterviewContext,
    type Difficulty,
    type QuestionRecord,
} from '../services/sessionManager.js';

export const interviewRouter = Router();

// Agent IDs from environment (lazy to ensure dotenv has loaded)
function getAgents() {
    return {
        interviewer: process.env.INTERVIEWER_AGENT_ID || '',
        evaluator: process.env.EVALUATOR_AGENT_ID || '',
        codeReviewer: process.env.CODE_REVIEWER_AGENT_ID || '',
        analyst: process.env.ANALYST_AGENT_ID || '',
    };
}

// ─── Types ──────────────────────────────────────────────

interface InterviewerResponse {
    type: 'video' | 'code';
    text: string;
    title?: string;
    difficulty: Difficulty;
    starterCode?: string;
    language?: string;
}

interface EvaluatorResponse {
    score: number;
    maxScore: number;
    difficulty: Difficulty;
    nextDifficulty: Difficulty;
    strengths: string[];
    weaknesses: string[];
    brief: string;
}

interface CodeReviewResponse {
    score: number;
    maxScore: number;
    correctness: boolean;
    timeComplexity: string;
    spaceComplexity: string;
    strengths: string[];
    issues: string[];
    brief: string;
}

// ─── POST /api/interview/start ──────────────────────────
// Creates a session and asks the Interviewer Agent for the first question

interviewRouter.post('/start', async (req: Request, res: Response) => {
    try {
        const { role = 'Senior Frontend Engineer', company = 'Nebula Systems' } = req.body;

        console.log(`\n🎬 Starting interview: ${role} @ ${company}`);

        // Create session
        let session = createSession(role, company);

        // Ask Interviewer Agent for first question (medium difficulty)
        const instruction = `
You are initializing the interview.
1. Generate the first technical question (Difficulty: medium, Type: video).
2. The question text should cover React topics (hooks, state, etc).
3. Return the FULL updated session object with this new question added to the "questions" array.
4. Ensure "currentQuestionIndex" is set to 1.
`;

        try {
            const updatedSession = await sendContextToAgent<any>(
                getAgents().interviewer,
                session as unknown as Record<string, unknown>,
                instruction
            );

            // Update local session store
            if (updatedSession && updatedSession.questions) {
                // If agent returned a valid session-like object
                updateSession(session.id, updatedSession);
                session = getSession(session.id)!;
                console.log(`  ✓ First question generated via Agent Context`);
            } else {
                throw new Error('Invalid agent response format');
            }

        } catch (err) {
            console.warn('  ⚠ Interviewer returned invalid context, using fallback question');
            // Fallback logic
            addQuestion(session.id, {
                type: 'video',
                text: 'Can you explain the difference between useState and useReducer in React? When would you choose one over the other?',
                title: 'React State Management',
                difficulty: 'medium',
            });
            session = getSession(session.id)!;
        }

        const currentQ = session.questions[session.questions.length - 1];

        res.json({
            sessionId: session.id,
            question: {
                id: currentQ.id,
                type: currentQ.type,
                text: currentQ.text,
                title: currentQ.title,
                difficulty: currentQ.difficulty,
                starterCode: currentQ.starterCode,
                language: currentQ.language,
            },
            totalQuestions: session.totalVideoQuestions + 1, // +1 for coding
            currentQuestion: session.questions.length,
        });
    } catch (error) {
        console.error('❌ Start error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ─── POST /api/interview/answer ─────────────────────────
// Evaluates the answer, then asks for the next question (or coding Q)

interviewRouter.post('/answer', async (req: Request, res: Response) => {
    try {
        const { sessionId, questionId, transcript, skipped } = req.body;

        if (!sessionId || !questionId) {
            res.status(400).json({ error: 'sessionId and questionId are required' });
            return;
        }

        console.log(`\n📨 Received answer for Q${questionId}:`);
        console.log(`   - Session: ${sessionId}`);
        console.log(`   - Skipped: ${skipped}`);

        let session = getSession(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const currentQ = session.questions.find(q => q.id === questionId);
        if (!currentQ) {
            res.status(404).json({ error: 'Question not found' });
            return;
        }

        // 1. Locally update with the answer first
        recordAnswer(sessionId, questionId, skipped ? '' : transcript, skipped);
        session = getSession(sessionId)!; // Refresh local reference

        // 2. Evaluator Step
        if (skipped) {
            console.log(`\n⏭ Question Q${questionId} skipped.`);
            // Mock evaluation for skipped
            const skippedEval: EvaluatorResponse = {
                score: 0,
                maxScore: 100,
                difficulty: session.currentDifficulty,
                nextDifficulty: session.currentDifficulty,
                strengths: [],
                weaknesses: ['Question skipped'],
                brief: 'Question skipped by candidate.',
            };
            recordEvaluation(sessionId, questionId, skippedEval);
        } else {
            console.log(`\n📝 Evaluating answer for Q${questionId}...`);
            const evalInstruction = `
You are the Evaluator.
1. Review the latest answer in the session (Question ID: ${questionId}).
2. Update the session by adding an "evaluation" object to that question.
3. Update "currentDifficulty" based on performance.
4. Return the FULL updated session JSON.
`;
            try {
                const updatedSession = await sendContextToAgent<any>(
                    getAgents().evaluator,
                    session as unknown as Record<string, unknown>,
                    evalInstruction
                );

                if (updatedSession && updatedSession.questions) {
                    updateSession(sessionId, updatedSession);
                    session = getSession(sessionId)!;
                    console.log(`  ✓ Evaluation recorded via Agent Context`);
                }
            } catch (err) {
                console.warn('  ⚠ Evaluator failed, using fallback');
                recordEvaluation(sessionId, questionId, {
                    score: 0,
                    nextDifficulty: session.currentDifficulty,
                    strengths: [],
                    weaknesses: ['AI evaluation unavailable'],
                    brief: 'Evaluation could not be completed.',
                });
            }
        }
        session = getSession(sessionId)!; // Refresh

        // 3. Interviewer Step (Next Question)
        const completedQuestions = session.questions.filter(q => q.type === 'video').length;
        const isLastVideoQ = completedQuestions >= session.totalVideoQuestions;

        const nextInstruction = isLastVideoQ
            ? `
You are the Interviewer.
1. The candidate has completed the video section.
2. Generate a "code" type question (React JS coding challenge).
3. Add it to the "questions" array.
4. Increment "currentQuestionIndex".
5. Return the FULL updated session JSON.
`
            : `
You are the Interviewer.
1. Generate the NEXT video question (React JS) based on the current difficulty (${session.currentDifficulty}).
2. It must be different from previous questions.
3. Add it to the "questions" array.
4. Increment "currentQuestionIndex".
5. Return the FULL updated session JSON.
`;

        console.log(`  → Generating next question (isLastVideo=${isLastVideoQ})...`);

        try {
            const updatedSession = await sendContextToAgent<any>(
                getAgents().interviewer,
                session as unknown as Record<string, unknown>,
                nextInstruction
            );

            if (updatedSession && updatedSession.questions) {
                updateSession(sessionId, updatedSession);
                session = getSession(sessionId)!;
                console.log(`  ✓ Next question generated via Agent Context`);
            }
        } catch (err) {
            console.warn('  ⚠ Interviewer failed, using fallback');
            // Fallback logic
            if (isLastVideoQ) {
                addQuestion(sessionId, {
                    type: 'code',
                    text: 'Create a custom React hook called useDebounce...',
                    title: 'Custom useDebounce Hook',
                    difficulty: session.currentDifficulty,
                    starterCode: '// Write your solution here\n',
                    language: 'javascript',
                });
            } else {
                addQuestion(sessionId, {
                    type: 'video',
                    text: 'What are React keys and why are they important?',
                    title: 'React Keys',
                    difficulty: session.currentDifficulty,
                });
            }
            session = getSession(sessionId)!;
        }

        const nextQ = session.questions[session.questions.length - 1];
        const currentEval = session.questions.find(q => q.id === questionId)?.evaluation;

        res.json({
            evaluation: currentEval,
            nextQuestion: nextQ.id !== questionId ? nextQ : null,
            isLastVideoQuestion: isLastVideoQ,
            currentQuestion: session.questions.length,
            totalQuestions: session.totalVideoQuestions + 1,
        });

    } catch (error) {
        console.error('❌ Answer error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ─── POST /api/interview/submit-code ────────────────────
// Sends code to the Code Reviewer Agent

// ─── POST /api/interview/submit-code ────────────────────
// Sends code to the Code Reviewer Agent

interviewRouter.post('/submit-code', async (req: Request, res: Response) => {
    try {
        const { sessionId, questionId, code, language } = req.body;

        if (!sessionId || !questionId) {
            res.status(400).json({ error: 'sessionId and questionId are required' });
            return;
        }

        let session = getSession(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const codeQ = session.questions.find(q => q.id === questionId);
        if (!codeQ) {
            res.status(404).json({ error: 'Question not found' });
            return;
        }

        console.log(`\n💻 Reviewing code submission for session ${sessionId}`);

        // 1. Record the code locally
        recordAnswer(sessionId, questionId, code);
        session = getSession(sessionId)!;

        // 2. Call Code Reviewer
        const isEmptyCode = !code || code.trim().length < 10 || code.trim() === '// Write your solution here';

        if (isEmptyCode) {
            console.warn('  ⚠ Empty code submitted');
            const emptyReview: QuestionRecord['codeReview'] = {
                score: 0,
                correctness: false,
                timeComplexity: 'N/A',
                spaceComplexity: 'N/A',
                strengths: [],
                issues: ['No code was submitted'],
                brief: 'Candidate did not submit any code.',
            };
            recordCodeReview(sessionId, questionId, emptyReview);
        } else {
            const reviewInstruction = `
You are the Code Reviewer.
1. Review the code answer for Question ID ${questionId}.
2. Update the session by adding a "codeReview" object to that question.
3. Return the FULL updated session JSON.
`;
            try {
                const updatedSession = await sendContextToAgent<any>(
                    getAgents().codeReviewer,
                    session as unknown as Record<string, unknown>,
                    reviewInstruction
                );

                if (updatedSession && updatedSession.questions) {
                    updateSession(sessionId, updatedSession);
                    session = getSession(sessionId)!;
                    console.log(`  ✓ Code review recorded via Agent Context`);
                }
            } catch (err) {
                console.warn('  ⚠ Code Reviewer failed, using fallback');
                recordCodeReview(sessionId, questionId, {
                    score: 0,
                    correctness: false,
                    timeComplexity: 'N/A',
                    spaceComplexity: 'N/A',
                    strengths: [],
                    issues: ['AI code review unavailable'],
                    brief: 'Code review could not be completed.',
                });
            }
        }

        session = getSession(sessionId)!;
        const review = session.questions.find(q => q.id === questionId)?.codeReview;

        res.json({ review });
    } catch (error) {
        console.error('❌ Code review error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ─── POST /api/interview/complete ───────────────────────
// Sends all interview data to the Analyst Agent for final report

// ─── POST /api/interview/complete ───────────────────────
// Sends all interview data to the Analyst Agent for final report

interviewRouter.post('/complete', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            res.status(400).json({ error: 'sessionId is required' });
            return;
        }

        let session = getSession(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        console.log(`\n📊 Generating final analysis for session ${sessionId}`);

        // Calculate duration outside the agent to ensure accuracy
        const startTime = new Date(session.startedAt);
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        const totalTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const analysisInstruction = `
You are the Analyst.
1. Review the full interview session.
2. Generate a comprehensive "analysis" object.
3. Include: overallScore, recommendation, summary, skillScores, questionResults, feedback.
4. Ensure "totalTime" is set to "${totalTime}".
5. Update the session by adding this "analysis" object.
6. Return the FULL updated session JSON.
`;

        try {
            const updatedSession = await sendContextToAgent<any>(
                getAgents().analyst,
                session as unknown as Record<string, unknown>,
                analysisInstruction
            );

            if (updatedSession && updatedSession.analysis) {
                // Ensure totalTime is preserved/set if agent missed it
                if (!updatedSession.analysis.totalTime) {
                    updatedSession.analysis.totalTime = totalTime;
                }

                updateSession(sessionId, updatedSession);
                completeSession(sessionId, updatedSession.analysis); // Marks completedAt
                session = getSession(sessionId)!;
                console.log(`  ✓ Analysis generated via Agent Context`);
            } else {
                throw new Error('Analyst returned invalid session structure');
            }

        } catch (err) {
            console.warn('  ⚠ Analyst failed, using fallback');
            // Fallback logic
            const scores = session.questions
                .filter(q => q.evaluation)
                .map(q => q.evaluation!.score);
            const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            const codeScore = session.questions.find(q => q.codeReview)?.codeReview?.score ?? 0;

            const fallbackAnalysis = {
                overallScore: Math.round((avgScore + codeScore) / 2),
                recommendation: avgScore >= 80 ? 'Strong Hire' : avgScore >= 65 ? 'Hire' : avgScore >= 50 ? 'Maybe' : 'No Hire',
                summary: `Candidate completed the ${session.role} interview. Average question score: ${avgScore}/100. Code challenge score: ${codeScore}/100.`,
                totalTime: totalTime,
                skillScores: {
                    reactFundamentals: avgScore,
                    problemSolving: codeScore,
                    technicalDepth: avgScore,
                    codeQuality: codeScore,
                    conceptualClarity: avgScore,
                },
                questionResults: session.questions.map((q, i) => ({
                    question: q.title || q.text.substring(0, 80),
                    score: q.evaluation?.score || q.codeReview?.score || 0,
                    maxScore: 100,
                    feedback: q.evaluation?.brief || q.codeReview?.brief || 'Completed',
                })),
                feedback: [
                    ...session.questions.flatMap(q =>
                        (q.evaluation?.strengths || []).map(s => ({ type: 'strength', text: s }))
                    ),
                    ...session.questions.flatMap(q =>
                        (q.evaluation?.weaknesses || []).map(w => ({ type: 'improvement', text: w }))
                    ),
                ],
            };
            completeSession(sessionId, fallbackAnalysis);
            session = getSession(sessionId)!;
        }

        res.json({ analysis: session.analysis });
    } catch (error) {
        console.error('❌ Analysis error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ─── GET /api/interview/session/:id ─────────────────────
// Get current session state (for debugging/resuming)

interviewRouter.get('/session/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const session = getSession(id);
    if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    res.json({ session });
});
