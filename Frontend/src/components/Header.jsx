import { useState } from 'react';
import { Menu, X, Plus, Download, Settings, Zap } from 'lucide-react';
import { generateStrategyPack } from '../utils/pdfGenerator';

const Header = ({ responses, startupIdea, darkMode = true }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPack = async () => {
    const hasResponses = Object.values(responses).some(response => response && response.trim());
    
    if (!hasResponses) {
      alert('Please generate some agent responses first before downloading the strategy pack.');
      return;
    }

    setIsDownloading(true);
    try {
      await generateStrategyPack(responses, startupIdea || 'No startup idea provided');
    } catch (error) {
      console.error('Error generating strategy pack:', error);
      alert('There was an error generating the strategy pack. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <header className={`sticky top-0 z-50 border-b transition-all duration-300 ${
      darkMode 
        ? 'glass-dark border-white/10' 
        : 'bg-white/80 backdrop-blur-md border-gray-200/50 shadow-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-neon-blue to-neon-purple flex items-center justify-center neon-blue">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-display font-bold gradient-text">
                CoPilotX
              </h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            <button className={`btn-futuristic flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
              darkMode 
                ? 'text-white/90 hover:text-white' 
                : 'text-gray-700 hover:text-gray-900 bg-white/50 hover:bg-white/80'
            }`}>
              <Plus className="w-4 h-4 mr-2" />
              New Idea
            </button>
            <button
              onClick={handleDownloadPack}
              disabled={isDownloading}
              className={`btn-futuristic flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover-glow-green ${
                darkMode 
                  ? 'text-white/90 hover:text-white' 
                  : 'text-gray-700 hover:text-gray-900 bg-white/50 hover:bg-white/80'
              }`}
            >
              {isDownloading ? (
                <>
                  <div className="neon-spinner w-4 h-4 mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Pack
                </>
              )}
            </button>
            <button className={`btn-futuristic flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
              darkMode 
                ? 'text-white/90 hover:text-white' 
                : 'text-gray-700 hover:text-gray-900 bg-white/50 hover:bg-white/80'
            }`}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </button>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`p-2 rounded-lg transition-all duration-300 ${
                darkMode 
                  ? 'glass text-white/70 hover:text-white hover:bg-white/10' 
                  : 'bg-white/50 text-gray-600 hover:text-gray-900 hover:bg-white/80'
              }`}
            >
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className={`rounded-lg mt-2 p-4 space-y-2 ${
              darkMode ? 'glass-card' : 'bg-white/80 backdrop-blur-md border border-gray-200/50'
            }`}>
              <button className={`btn-futuristic flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                darkMode 
                  ? 'text-white/90 hover:text-white' 
                  : 'text-gray-700 hover:text-gray-900'
              }`}>
                <Plus className="w-4 h-4 mr-2" />
                New Idea
              </button>
              <button
                onClick={handleDownloadPack}
                disabled={isDownloading}
                className={`btn-futuristic flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                  darkMode 
                    ? 'text-white/90 hover:text-white' 
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                {isDownloading ? (
                  <>
                    <div className="neon-spinner w-4 h-4 mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export Pack
                  </>
                )}
              </button>
              <button className={`btn-futuristic flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                darkMode 
                  ? 'text-white/90 hover:text-white' 
                  : 'text-gray-700 hover:text-gray-900'
              }`}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;