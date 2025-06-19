import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, User, Code, TrendingUp, DollarSign } from 'lucide-react';
import TypewriterEffect from './TypewriterEffect';

const agentIcons = {
  CEO: User,
  CTO: Code,
  CMO: TrendingUp,
  CFO: DollarSign
};

const agentColors = {
  CEO: {
    gradient: 'from-purple-500 to-pink-500',
    neon: 'neon-purple',
    glow: 'hover-glow-purple',
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
    lightText: 'text-purple-600',
    lightBg: 'bg-purple-100'
  },
  CTO: {
    gradient: 'from-blue-500 to-cyan-500',
    neon: 'neon-blue',
    glow: 'hover-glow-blue',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    lightText: 'text-blue-600',
    lightBg: 'bg-blue-100'
  },
  CMO: {
    gradient: 'from-green-500 to-emerald-500',
    neon: 'neon-green',
    glow: 'hover-glow-green',
    text: 'text-green-400',
    bg: 'bg-green-500/10',
    lightText: 'text-green-600',
    lightBg: 'bg-green-100'
  },
  CFO: {
    gradient: 'from-yellow-500 to-orange-500',
    neon: 'neon-pink',
    glow: 'hover-glow-pink',
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    lightText: 'text-orange-600',
    lightBg: 'bg-orange-100'
  }
};

const AgentCard = ({ agent, isLoading, response, onRegenerate, darkMode = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTypewriter, setShowTypewriter] = useState(false);
  const IconComponent = agentIcons[agent];
  const colors = agentColors[agent];

  useEffect(() => {
    if (response && !isLoading) {
      setIsExpanded(true);
      setShowTypewriter(true);
    }
  }, [response, isLoading]);

  return (
    <div className={`rounded-2xl overflow-hidden transition-all duration-300 card-popup ${colors.glow} ${
      isExpanded ? 'shadow-popup-hover' : 'shadow-popup'
    } ${
      darkMode 
        ? 'glass-card' 
        : 'bg-white/70 backdrop-blur-md border border-gray-200/50 shadow-lg'
    }`}>
      <div 
        className={`flex items-center justify-between p-6 cursor-pointer transition-all duration-300 ${
          darkMode ? 'hover:bg-white/5' : 'hover:bg-white/30'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-xl bg-gradient-to-r ${colors.gradient} ${colors.neon} flex items-center justify-center transition-all duration-300 scale-hover`}>
            <IconComponent className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`font-display font-semibold text-lg ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {agent} Co-Founder
            </h3>
            <p className={`text-sm ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {getAgentDescription(agent)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {isLoading && (
            <div className={`neon-spinner w-6 h-6`}></div>
          )}
          <div className={`p-2 rounded-lg transition-all duration-300 popup-hover ${isExpanded ? 'rotate-180' : ''} ${
            darkMode ? 'glass' : 'bg-white/50'
          }`}>
            <ChevronDown className={`w-5 h-5 ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`} />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-6">
          <div className={`border-t pt-6 ${
            darkMode ? 'border-white/10' : 'border-gray-200/50'
          }`}>
            {isLoading ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex space-x-4 animate-pulse">
                      <div className="flex-1 space-y-2">
                        <div className={`h-4 rounded w-3/4 ${
                          darkMode ? 'bg-white/10' : 'bg-gray-200'
                        }`}></div>
                        <div className={`h-4 rounded w-1/2 ${
                          darkMode ? 'bg-white/10' : 'bg-gray-200'
                        }`}></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`text-sm flex items-center ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <div className={`neon-spinner w-4 h-4 mr-3`}></div>
                  <span className="typing-animation">
                    {agent} is analyzing your startup idea...
                  </span>
                </div>
              </div>
            ) : response ? (
              <div className="space-y-6">
                <div className={`rounded-xl p-6 transition-all duration-300 popup-hover ${
                  darkMode ? 'glass-dark' : 'bg-white/50 backdrop-blur-sm border border-gray-200/30'
                }`}>
                  <div className={`leading-relaxed ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {showTypewriter ? (
                      <TypewriterEffect 
                        text={response} 
                        speed={20}
                        className="whitespace-pre-wrap"
                        darkMode={darkMode}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">{response}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onRegenerate(agent)}
                  className={`btn-futuristic flex items-center text-sm transition-all duration-300 px-4 py-2 rounded-lg scale-hover ${colors.glow} ${
                    darkMode 
                      ? `${colors.text} hover:text-white` 
                      : `${colors.lightText} hover:text-gray-900 bg-white/50 hover:bg-white/80`
                  }`}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate Response
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${colors.gradient} ${colors.neon} flex items-center justify-center mx-auto mb-4 opacity-50 transition-all duration-300 popup-hover`}>
                  <IconComponent className="w-8 h-8 text-white" />
                </div>
                <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                  Submit your startup idea to get {agent} insights
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const getAgentDescription = (agent) => {
  const descriptions = {
    CEO: 'Strategy & Vision Leadership',
    CTO: 'Technology & Development',
    CMO: 'Marketing & Growth Strategy',
    CFO: 'Finance & Operations'
  };
  return descriptions[agent];
};

export default AgentCard;