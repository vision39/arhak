// --- Shared Types & Interfaces ---

export interface InterviewData {
    company: string;
    role: string;
    interviewer: string;
    duration: string;
}

export type QuestionType = 'video' | 'code';

export interface BaseQuestion {
    id: number;
    type: QuestionType;
    text: string;
}

export interface VideoQuestion extends BaseQuestion {
    type: 'video';
}

export interface CodeQuestion extends BaseQuestion {
    type: 'code';
    title: string;
    starterCode: string;
    language: string;
}

export type Question = VideoQuestion | CodeQuestion;
