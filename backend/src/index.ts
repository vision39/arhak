// Load .env BEFORE any other imports so env vars are available at module init
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { interviewRouter } from './routes/interview.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/interview', interviewRouter);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start
app.listen(PORT, () => {
    console.log(`\n🚀 Interview Backend running on http://localhost:${PORT}`);
    console.log(`📋 Health: http://localhost:${PORT}/api/health`);
    console.log(`🤖 Archestra: ${process.env.ARCHESTRA_BASE_URL}`);
    console.log(`🎙️ Agents: interviewer=${process.env.INTERVIEWER_AGENT_ID?.substring(0, 8)}, evaluator=${process.env.EVALUATOR_AGENT_ID?.substring(0, 8)}\n`);
});
