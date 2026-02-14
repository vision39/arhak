/**
 * Interview Routes
 * Orchestrates the 4-agent swarm for adaptive interviews
 */
import { Router, Request, Response } from 'express';
import { sendToAgent, parseAgentJSON } from '../services/archestra.js';
import {
    createSession,
    getSession,
    addQuestion,
    recordAnswer,
    recordEvaluation,
    recordCodeReview,
    completeSession,
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
        const session = createSession(role, company);

        // Ask Interviewer Agent for first question (medium difficulty)
        const prompt = `
You are interviewing a candidate for the role of "${role}" at "${company}".
This is question #1. Difficulty: medium.
Generate a React JS technical question. Topics can include: React hooks (useState, useEffect, useCallback, useMemo), component lifecycle, state management, props, JSX, virtual DOM, React performance optimization, or React design patterns.
It should be a "video" type question (not coding).
Respond with ONLY a JSON object like: {"type":"video","text":"your question","title":"short title","difficulty":"medium"}`;

        const rawResponse = await sendToAgent(getAgents().interviewer, [
            { role: 'user', content: prompt },
        ]);

        let question: InterviewerResponse;
        try {
            question = parseAgentJSON<InterviewerResponse>(rawResponse);
        } catch {
            console.warn('  ⚠ Interviewer returned empty/invalid response, using fallback question');
            question = {
                type: 'video',
                text: 'Can you explain the difference between useState and useReducer in React? When would you choose one over the other?',
                title: 'React State Management',
                difficulty: 'medium',
            };
        }

        // Store the question in the session
        const stored = addQuestion(session.id, {
            type: question.type || 'video',
            text: question.text,
            title: question.title,
            difficulty: question.difficulty || 'medium',
            starterCode: question.starterCode,
            language: question.language,
        });

        console.log(`  ✓ First question generated (${stored.difficulty})`);

        res.json({
            sessionId: session.id,
            question: {
                id: stored.id,
                type: stored.type,
                text: stored.text,
                title: stored.title,
                difficulty: stored.difficulty,
                starterCode: stored.starterCode,
                language: stored.language,
            },
            totalQuestions: session.totalVideoQuestions + 1, // +1 for coding
            currentQuestion: 1,
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
        console.log(`   - Transcript length: ${transcript ? transcript.length : 0}`);
        console.log(`   - Transcript preview: "${transcript ? transcript.substring(0, 50) + '...' : 'N/A'}"`);

        const session = getSession(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const currentQ = session.questions.find(q => q.id === questionId);
        if (!currentQ) {
            res.status(404).json({ error: 'Question not found' });
            return;
        }

        let nextDifficulty = session.currentDifficulty;

        let evaluation: EvaluatorResponse;

        if (skipped) {
            console.log(`\n⏭ Question Q${questionId} skipped. Moving to next question (keeping ${nextDifficulty} difficulty).`);
            recordAnswer(sessionId, questionId, '', true);

            // Create a dummy evaluation record for the response
            evaluation = {
                score: 0,
                maxScore: 100,
                difficulty: session.currentDifficulty,
                nextDifficulty: session.currentDifficulty,
                strengths: [],
                weaknesses: ['Question skipped'],
                brief: 'Question skipped by candidate.',
            };
        } else {
            console.log(`\n📝 Evaluating answer for Q${questionId} (${session.role})`);
            // 1. Record the answer
            recordAnswer(sessionId, questionId, transcript);

            // 2. Send to Evaluator Agent
            const evalPrompt = `
Evaluate this candidate's answer for a "${session.role}" interview.

Question [${currentQ.difficulty}]: ${currentQ.text}

Candidate's Answer: "${transcript}"

Score this answer and determine the next difficulty level.
Respond with ONLY a JSON object.`;

            const evalRaw = await sendToAgent(getAgents().evaluator, [
                { role: 'user', content: evalPrompt },
            ]);

            try {
                evaluation = parseAgentJSON<EvaluatorResponse>(evalRaw);
            } catch {
                console.warn('  ⚠ Evaluator returned empty/invalid response, using fallback');
                evaluation = {
                    score: 0,
                    maxScore: 100,
                    difficulty: session.currentDifficulty,
                    nextDifficulty: session.currentDifficulty,
                    strengths: [],
                    weaknesses: ['AI evaluation unavailable'],
                    brief: 'Evaluation could not be completed.',
                };
            }
            recordEvaluation(sessionId, questionId, {
                score: evaluation.score,
                nextDifficulty: evaluation.nextDifficulty,
                strengths: evaluation.strengths,
                weaknesses: evaluation.weaknesses,
                brief: evaluation.brief,
            });

            nextDifficulty = evaluation.nextDifficulty;
            console.log(`  ✓ Score: ${evaluation.score}/100 → next difficulty: ${nextDifficulty}`);
        }

        // 3. Determine what comes next
        // Count skipped questions as "answered" regarding progression, but we keep asking video questions up to total limit
        const completedQuestions = session.questions.filter(q => q.type === 'video' && (q.answer || q.skipped)).length;
        const isLastVideoQ = completedQuestions >= session.totalVideoQuestions;

        let nextQuestion: QuestionRecord | null = null;

        if (isLastVideoQ) {
            // Generate a coding question
            console.log(`  → Generating coding question...`);

            const codePrompt = `
You are interviewing a candidate for "${session.role}" at "${session.company}".
This is a React JS coding challenge (final question). Difficulty: ${nextDifficulty}.

Previous interview context:
${buildInterviewContext(session)}

Generate a React JS coding challenge. It MUST be type "code" with title, text (problem description), starterCode, and language (javascript).
The challenge should involve React concepts like: building a custom hook, implementing a component with state management, creating a reusable component, or solving a React-specific problem.
Respond with ONLY a JSON object like: {"type":"code","text":"description","title":"short title","difficulty":"${nextDifficulty}","starterCode":"// code here","language":"javascript"}`;

            const codeRaw = await sendToAgent(getAgents().interviewer, [
                { role: 'user', content: codePrompt },
            ]);

            let codeQ: InterviewerResponse;
            try {
                codeQ = parseAgentJSON<InterviewerResponse>(codeRaw);
            } catch {
                console.warn('  ⚠ Interviewer returned empty/invalid coding question, using fallback');
                codeQ = {
                    type: 'code',
                    text: 'Create a custom React hook called useDebounce that takes a value and a delay in milliseconds. The hook should return the debounced value that only updates after the specified delay has passed since the last change.',
                    title: 'Custom useDebounce Hook',
                    difficulty: nextDifficulty,
                    starterCode: 'import { useState, useEffect } from "react";\n\nfunction useDebounce(value, delay) {\n  // Your implementation here\n}\n\nexport default useDebounce;\n',
                    language: 'javascript',
                };
            }

            nextQuestion = addQuestion(sessionId, {
                type: 'code',
                text: codeQ.text,
                title: codeQ.title || 'Coding Challenge',
                difficulty: codeQ.difficulty || nextDifficulty,
                starterCode: codeQ.starterCode || '// Write your solution here\n',
                language: codeQ.language || 'javascript',
            });
        } else {
            // Generate next video question
            const qNumber = completedQuestions + 1;
            console.log(`  → Generating Q${qNumber + 1} (${nextDifficulty})...`);

            const nextPrompt = `
You are interviewing a candidate for "${session.role}" at "${session.company}".
This is question #${qNumber + 1}. Difficulty: ${nextDifficulty}.
Topic: React JS only.

Previous interview context:
${buildInterviewContext(session)}

Based on the candidate's previous answers (or skipped questions), generate the NEXT React JS follow-up question.
IMPORTANT: Ensure this question is DIFFERENT from all previously asked questions listed above.
- If they skipped the last question, ask a different question of the same difficulty.
- If they did well, probe deeper into advanced React topics (concurrent mode, suspense, server components, reconciliation, fiber architecture)
- If they struggled, ask about fundamental React concepts (hooks, state, props, effects)
- It should be a "video" type question (not coding)
Respond with ONLY a JSON object like: {"type":"video","text":"your question","title":"short title","difficulty":"${nextDifficulty}"}`;

            const nextRaw = await sendToAgent(getAgents().interviewer, [
                { role: 'user', content: nextPrompt },
            ]);

            let nextQ: InterviewerResponse;
            try {
                nextQ = parseAgentJSON<InterviewerResponse>(nextRaw);
            } catch {
                console.warn('  ⚠ Interviewer returned empty/invalid next question, using fallback');
                const fallbackQs = [
                    { text: 'What is the virtual DOM in React and how does it improve performance?', title: 'Virtual DOM' },
                    { text: 'Explain the useEffect cleanup function. When and why would you use it?', title: 'useEffect Cleanup' },
                    { text: 'What are React keys and why are they important when rendering lists?', title: 'React Keys' },
                ];
                const pick = fallbackQs[Math.floor(Math.random() * fallbackQs.length)];
                nextQ = {
                    type: 'video',
                    text: pick.text,
                    title: pick.title,
                    difficulty: nextDifficulty,
                };
            }

            nextQuestion = addQuestion(sessionId, {
                type: nextQ.type || 'video',
                text: nextQ.text,
                title: nextQ.title,
                difficulty: nextQ.difficulty || nextDifficulty,
            });
        }

        console.log(`  ✓ Next question ready`);

        res.json({
            evaluation: {
                score: evaluation.score,
                strengths: evaluation.strengths,
                weaknesses: evaluation.weaknesses,
                brief: evaluation.brief,
                nextDifficulty: evaluation.nextDifficulty,
            },
            nextQuestion: nextQuestion ? {
                id: nextQuestion.id,
                type: nextQuestion.type,
                text: nextQuestion.text,
                title: nextQuestion.title,
                difficulty: nextQuestion.difficulty,
                starterCode: nextQuestion.starterCode,
                language: nextQuestion.language,
            } : null,
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

interviewRouter.post('/submit-code', async (req: Request, res: Response) => {
    try {
        const { sessionId, questionId, code, language } = req.body;

        if (!sessionId || !questionId || !code) {
            res.status(400).json({ error: 'sessionId, questionId, and code are required' });
            return;
        }

        const session = getSession(sessionId);
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

        // Record the code as the "answer"
        recordAnswer(sessionId, questionId, code);

        // Send to Code Reviewer Agent
        const reviewPrompt = `
You are an expert code reviewer evaluating interview coding submissions. You receive the problem description and the candidate's submitted code.

Problem: ${codeQ.title}
Description: ${codeQ.text}

Submitted Code (${language || 'javascript'}):
\`\`\`${language || 'javascript'}
${code}
\`\`\`

EVALUATE: correctness, efficiency (time/space complexity), code quality, edge case handling, readability.

RESPONSE FORMAT (strict JSON):
{
  "score": 82,
  "maxScore": 100,
  "correctness": true,
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(n)",
  "strengths": ["Handles edge cases", "Clean recursion"],
  "issues": ["Could use iterative approach for better space"],
  "brief": "One-line summary"
}

Check the code inside the function and give scoring according to the logic written inside the function and nothing else.

Never include anything outside the JSON object.`;

        const reviewRaw = await sendToAgent(getAgents().codeReviewer, [
            { role: 'user', content: reviewPrompt },
        ]);

        let review: CodeReviewResponse;
        const isEmptyCode = !code || code.trim().length < 10 || code.trim() === '// Write your solution here';
        if (isEmptyCode) {
            console.warn('  ⚠ Empty or no code submitted, scoring 0');
            review = {
                score: 0,
                maxScore: 100,
                correctness: false,
                timeComplexity: 'N/A',
                spaceComplexity: 'N/A',
                strengths: [],
                issues: ['No code was submitted'],
                brief: 'Candidate did not submit any code.',
            };
        } else {
            try {
                review = parseAgentJSON<CodeReviewResponse>(reviewRaw);
            } catch {
                console.warn('  ⚠ Code Reviewer returned empty/invalid response, using fallback');
                review = {
                    score: 0,
                    maxScore: 100,
                    correctness: false,
                    timeComplexity: 'N/A',
                    spaceComplexity: 'N/A',
                    strengths: [],
                    issues: ['AI code review unavailable'],
                    brief: 'Code review could not be completed.',
                };
            }
        }
        recordCodeReview(sessionId, questionId, {
            score: review.score,
            correctness: review.correctness,
            timeComplexity: review.timeComplexity,
            spaceComplexity: review.spaceComplexity,
            strengths: review.strengths,
            issues: review.issues,
            brief: review.brief,
        });

        console.log(`  ✓ Code review: ${review.score}/100 | Correct: ${review.correctness}`);

        res.json({
            review: {
                score: review.score,
                correctness: review.correctness,
                timeComplexity: review.timeComplexity,
                spaceComplexity: review.spaceComplexity,
                strengths: review.strengths,
                issues: review.issues,
                brief: review.brief,
            },
        });
    } catch (error) {
        console.error('❌ Code review error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ─── POST /api/interview/complete ───────────────────────
// Sends all interview data to the Analyst Agent for final report

interviewRouter.post('/complete', async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            res.status(400).json({ error: 'sessionId is required' });
            return;
        }

        const session = getSession(sessionId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        console.log(`\n📊 Generating final analysis for session ${sessionId}`);

        // Build comprehensive data for the Analyst
        const interviewData = session.questions.map((q, i) => ({
            questionNumber: i + 1,
            type: q.type,
            difficulty: q.difficulty,
            question: q.text,
            title: q.title,
            answer: q.answer || 'No answer provided',
            evaluation: q.evaluation ? {
                score: q.evaluation.score,
                strengths: q.evaluation.strengths,
                weaknesses: q.evaluation.weaknesses,
            } : null,
            codeReview: q.codeReview ? {
                score: q.codeReview.score,
                correctness: q.codeReview.correctness,
                timeComplexity: q.codeReview.timeComplexity,
            } : null,
        }));

        const startTime = new Date(session.startedAt);
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        const totalTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const analysisPrompt = `
Generate a comprehensive interview analysis report.

Role: ${session.role} at ${session.company}
Duration: ${totalTime}

Full Interview Data:
${JSON.stringify(interviewData, null, 2)}

Create a detailed analysis with overall score, skill scores, per-question results, and feedback.
The totalTime field should be "${totalTime}".
Respond with ONLY a JSON object.`;

        const analysisRaw = await sendToAgent(getAgents().analyst, [
            { role: 'user', content: analysisPrompt },
        ]);

        let analysis: Record<string, unknown>;
        try {
            analysis = parseAgentJSON<Record<string, unknown>>(analysisRaw);
        } catch {
            console.warn('  ⚠ Analyst returned empty/invalid response, generating fallback analysis');
            // Build fallback analysis from session data
            const scores = session.questions
                .filter(q => q.evaluation)
                .map(q => q.evaluation!.score);
            const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            const codeScore = session.questions.find(q => q.codeReview)?.codeReview?.score ?? 0;

            analysis = {
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
        }

        // Ensure totalTime is set
        if (!analysis.totalTime) {
            analysis.totalTime = totalTime;
        }

        completeSession(sessionId, analysis);

        console.log(`  ✓ Analysis complete`);

        res.json({ analysis });
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
