import { InterviewData, Question } from '../types';

export const INTERVIEW_DATA: InterviewData = {
    company: "Nebula Systems",
    role: "Senior Frontend Engineer",
    interviewer: "AI Evaluator",
    duration: "Approx 30 min",
};

export const QUESTIONS: Question[] = [
    {
        id: 1,
        type: 'video',
        text: "Tell me about a time you had to optimize a React application for performance. What specific metrics did you target?"
    },
    {
        id: 2,
        type: 'video',
        text: "Describe a challenging bug you encountered recently. How did you debug and resolve it?"
    },
    {
        id: 3,
        type: 'video',
        text: "How do you approach designing a component architecture for a large-scale frontend application?"
    },
    {
        id: 4,
        type: 'code',
        title: "Array Flattening",
        text: "Write a function that takes a nested array and returns a flat array. You cannot use the built-in .flat() method.",
        starterCode: "// Function to flatten nested arrays\nfunction flatten(arr) {\n  // Your implementation here\n  \n  return [];\n}\n\n// Test Case:\n// console.log(flatten([1, [2, [3, 4], 5]]));",
        language: "javascript"
    },
];
