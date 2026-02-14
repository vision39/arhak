import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ActiveInterviewView from '../components/ActiveInterviewView';

const InterviewPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const resumeFrom = parseInt(searchParams.get('resumeFrom') || '0', 10);

    return (
        <ActiveInterviewView
            onLeave={() => navigate('/')}
            onComplete={() => navigate('/completed')}
            startIndex={resumeFrom}
        />
    );
};

export default InterviewPage;
