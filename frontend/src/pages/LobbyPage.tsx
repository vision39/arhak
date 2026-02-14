import React from 'react';
import { useNavigate } from 'react-router-dom';
import LobbyView from '../components/LobbyView';

const LobbyPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <LobbyView onJoin={() => navigate('/interview')} />
    );
};

export default LobbyPage;
