import { useState } from 'react';
import { X, Lightbulb, Rocket, Sparkles } from 'lucide-react';

const NewIdeaModal = ({ isOpen, onClose, onSubmit, darkMode = true }) => {
  const [idea, setIdea] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!idea.trim()) return;
    
    setIsSubmitting(true);
    await onSubmit(idea);
    setIsSubmitting(false);
    setIdea('');
    onClose();
  };

  const handleClose = () => {
    setIdea('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      ></div>
      
      {/* Modal */}
      <div className={`relative w-full max-w-2xl rounded-2xl p-8 card-popup transition-all duration-300 ${
        darkMode 
          ? 'glass-card' 
          : 'bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-neon-blue to-neon-purple flex items-center justify-center neon-blue mr-4 scale-hover transition-all duration-300">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className={`text-2xl font-display font-semibold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                New Startup Idea
              </h2>
              <p className={`text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Start fresh with a new concept
              </p>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg transition-all duration-300 popup-hover ${
              darkMode 
                ? 'glass text-white/70 hover:text-white hover:bg-white/10' 
                : 'bg-white/50 text-gray-600 hover:text-gray-900 hover:bg-white/80'
            }`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <textarea
              rows={6}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              className={`w-full px-6 py-4 rounded-xl focus:ring-2 focus:ring-neon-blue focus:border-transparent resize-none transition-all duration-300 focus:shadow-neon-blue popup-hover ${
                darkMode 
                  ? 'glass-dark text-white placeholder-gray-400' 
                  : 'bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-900 placeholder-gray-500'
              }`}
              placeholder="Describe your new startup idea in detail... What problem does it solve? Who is your target audience? What makes it unique?"
            />
            <div className={`absolute bottom-4 right-4 text-xs ${
              darkMode ? 'text-gray-500' : 'text-gray-400'
            }`}>
              {idea.length}/1000
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="submit"
              disabled={!idea.trim() || isSubmitting}
              className="flex-1 relative overflow-hidden bg-gradient-to-r from-neon-blue to-neon-purple text-white font-semibold py-4 px-8 rounded-xl hover:shadow-neon-blue focus:outline-none focus:ring-2 focus:ring-neon-blue focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 scale-hover group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-neon-purple to-neon-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center justify-center">
                {isSubmitting ? (
                  <>
                    <div className="neon-spinner w-5 h-5 mr-3"></div>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5 mr-3" />
                    <span>Launch Analysis</span>
                    <Sparkles className="w-4 h-4 ml-2 opacity-70" />
                  </>
                )}
              </div>
            </button>
            
            <button
              type="button"
              onClick={handleClose}
              className={`btn-futuristic px-6 py-4 rounded-xl transition-all duration-300 scale-hover ${
                darkMode 
                  ? 'text-white/80 hover:text-white' 
                  : 'text-gray-600 hover:text-gray-900 bg-white/50 hover:bg-white/80'
              }`}
            >
              Cancel
            </button>
          </div>
        </form>
        
        <div className={`mt-6 flex items-center text-sm ${
          darkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>
          <div className="w-2 h-2 rounded-full bg-neon-green mr-3 animate-pulse"></div>
          <span>Your previous analysis will be cleared and replaced with new insights</span>
        </div>
      </div>
    </div>
  );
};

export default NewIdeaModal;