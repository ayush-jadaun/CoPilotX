import { useState } from 'react';
import Header from './components/Header';
import InputArea from './components/InputArea';
import AgentOutput from './components/AgentOutput';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import ParticleBackground from './components/ParticleBackground';
import NewIdeaModal from './components/NewIdeaModal';
import SettingsModal from './components/SettingsModal';
import useDarkMode from './hooks/useDarkMode';
import { simulateAgentResponse } from './utils/agentSimulator';

function App() {
  const [darkMode, setDarkMode] = useDarkMode();
  const [responses, setResponses] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  const [currentStartupIdea, setCurrentStartupIdea] = useState('');
  const [isNewIdeaModalOpen, setIsNewIdeaModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleSubmitIdea = async (idea) => {
    setCurrentStartupIdea(idea);
    const agents = ['CEO', 'CTO', 'CMO', 'CFO'];
    
    // Set all agents to loading state
    const newLoadingStates = agents.reduce((acc, agent) => {
      acc[agent] = true;
      return acc;
    }, {});
    setLoadingStates(newLoadingStates);
    
    // Clear previous responses
    setResponses({});
    
    // Simulate agent responses
    const responsePromises = agents.map(async (agent) => {
      try {
        const response = await simulateAgentResponse(agent, idea);
        setResponses(prev => ({ ...prev, [agent]: response }));
      } catch (error) {
        setResponses(prev => ({ 
          ...prev, 
          [agent]: `Sorry, there was an error generating the ${agent} response. Please try again.` 
        }));
      } finally {
        setLoadingStates(prev => ({ ...prev, [agent]: false }));
      }
    });
    
    // Wait for all responses to complete
    await Promise.all(responsePromises);
  };

  const handleRegenerateAgent = async (agent) => {
    setLoadingStates(prev => ({ ...prev, [agent]: true }));
    
    try {
      const response = await simulateAgentResponse(agent, currentStartupIdea || 'regenerated analysis');
      setResponses(prev => ({ ...prev, [agent]: response }));
    } catch (error) {
      setResponses(prev => ({ 
        ...prev, 
        [agent]: `Sorry, there was an error regenerating the ${agent} response. Please try again.` 
      }));
    } finally {
      setLoadingStates(prev => ({ ...prev, [agent]: false }));
    }
  };

  const handleNewIdea = () => {
    setIsNewIdeaModalOpen(true);
  };

  const handleSettings = () => {
    setIsSettingsModalOpen(true);
  };

  return (
    <div className={`min-h-screen transition-all duration-500 relative overflow-hidden ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black' 
        : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
    }`}>
      <ParticleBackground darkMode={darkMode} />
      
      <Header 
        responses={responses} 
        startupIdea={currentStartupIdea} 
        darkMode={darkMode}
        onNewIdea={handleNewIdea}
        onSettings={handleSettings}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 animate-float">
                <span className="gradient-text">CoPilotX</span>
              </h1>
              <p className={`text-2xl md:text-3xl font-display font-medium mb-4 ${
                darkMode ? 'text-white/90' : 'text-gray-800'
              }`}>
                Your AI Startup{' '}
                <span className="text-neon-blue">Co-Founder</span>
              </p>
              <p className={`text-lg max-w-3xl mx-auto leading-relaxed ${
                darkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Transform your startup idea with expert insights from AI-powered CEO, CTO, CMO, and CFO perspectives
              </p>
            </div>
            
            <InputArea onSubmit={handleSubmitIdea} darkMode={darkMode} />
            <AgentOutput 
              responses={responses}
              loadingStates={loadingStates}
              onRegenerate={handleRegenerateAgent}
              darkMode={darkMode}
            />
          </div>
          
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Sidebar darkMode={darkMode} />
          </div>
        </div>
      </main>
      
      <Footer darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      
      {/* Modals */}
      <NewIdeaModal
        isOpen={isNewIdeaModalOpen}
        onClose={() => setIsNewIdeaModalOpen(false)}
        onSubmit={handleSubmitIdea}
        darkMode={darkMode}
      />
      
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
    </div>
  );
}

export default App;