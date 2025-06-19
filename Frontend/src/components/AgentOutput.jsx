import AgentCard from './AgentCard';

const AgentOutput = ({ responses, loadingStates, onRegenerate, darkMode = true }) => {
  const agents = ['CEO', 'CTO', 'CMO', 'CFO'];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className={`text-3xl font-display font-bold mb-4 ${
          darkMode ? 'text-white' : 'text-gray-900'
        }`}>
          Your AI Co-Founder Team
        </h2>
        <p className={`max-w-2xl mx-auto ${
          darkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Each AI co-founder brings specialized expertise to analyze your startup from their unique perspective
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
        {agents.map((agent) => (
          <AgentCard
            key={agent}
            agent={agent}
            isLoading={loadingStates[agent]}
            response={responses[agent]}
            onRegenerate={onRegenerate}
            darkMode={darkMode}
          />
        ))}
      </div>
    </div>
  );
};

export default AgentOutput;