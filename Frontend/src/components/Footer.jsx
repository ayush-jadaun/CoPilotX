import { Moon, Sun, Heart, Zap } from 'lucide-react';

const Footer = ({ darkMode, toggleDarkMode }) => {
  return (
    <footer className="glass-dark border-t border-white/10 mt-16 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <div className="flex items-center text-sm text-gray-400">
            <span>Built with</span>
            <Heart className="w-4 h-4 mx-2 text-neon-pink animate-pulse" />
            <span>on</span>
            <a
              href="https://bolt.new"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-neon-blue hover:text-white transition-colors duration-300 font-medium"
            >
              REACT
            </a>
            <Zap className="w-4 h-4 ml-2 text-neon-blue" />
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-xs text-gray-500">
              Powered by AI • Futuristic Design
            </div>
            <button
              onClick={toggleDarkMode}
              className="btn-futuristic flex items-center px-4 py-2 text-sm font-medium text-white/80 hover:text-white rounded-lg transition-all duration-300 hover-glow-blue"
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 mr-2" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 mr-2" />
                  Dark Mode
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-white/10 text-center">
          <p className="text-xs text-gray-500">
            © 2024 CoPilotX. Transforming startup dreams into reality with AI-powered insights.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;