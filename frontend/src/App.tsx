import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import LobbyPage from './pages/LobbyPage';
import InterviewPage from './pages/InterviewPage';
import CompletionPage from './pages/CompletionPage';
import CodingChallengePage from './pages/CodingChallengePage';

const App: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <BrowserRouter>
      <div className={`flex flex-col h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 overflow-hidden ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}>
        <Header />

        <main className="flex-1 relative z-10 overflow-hidden">
          <Routes>
            <Route path="/" element={<LobbyPage />} />
            <Route path="/interview" element={<InterviewPage />} />
            <Route path="/coding" element={<CodingChallengePage />} />
            <Route path="/completed" element={<CompletionPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;