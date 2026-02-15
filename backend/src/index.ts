// Load .env BEFORE any other imports so env vars are available at module init
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { interviewRouter } from './routes/interview.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
].filter(Boolean); // Filter out undefined values

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // TEMPORARY: Allow all origins to debug Vercel deployment
        // Once working, revert to strict checking
        if (allowedOrigins.indexOf(origin) === -1) {
            console.log(`⚠️ Allowing untrusted origin: ${origin}`);
        }
        callback(null, true);
    },
    credentials: true,
}));
app.options('*', cors()); // Enable pre-flight for all routes
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/interview', interviewRouter);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route for deployment checks
app.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Interview Backend',
        timestamp: new Date().toISOString()
    });
});

// Start
app.listen(PORT, () => {
    console.log(`\n🚀 Interview Backend running on http://localhost:${PORT}`);
    console.log(`📋 Health: http://localhost:${PORT}/api/health`);
    console.log(`🤖 Archestra: ${process.env.ARCHESTRA_BASE_URL}`);
    console.log(`🎙️ Agents: interviewer=${process.env.INTERVIEWER_AGENT_ID?.substring(0, 8)}, evaluator=${process.env.EVALUATOR_AGENT_ID?.substring(0, 8)}\n`);
});
