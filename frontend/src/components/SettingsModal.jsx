import { useState } from 'react';
import { X, Settings, Moon, Sun, Zap, Bell, Download, Trash2, RefreshCw } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose, darkMode, toggleDarkMode }) => {
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [analyticsLevel, setAnalyticsLevel] = useState('detailed');

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all saved data? This action cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleExportData = () => {
    const data = {
      preferences: {
        darkMode,
        notifications,
        autoSave,
        analyticsLevel
      },
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `copilotx-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      {/* Modal */}
      <div className={`relative w-full max-w-2xl rounded-2xl p-8 card-popup transition-all duration-300 max-h-[90vh] overflow-y-auto ${
        darkMode 
          ? 'glass-card' 
          : 'bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink flex items-center justify-center neon-purple mr-4 scale-hover transition-all duration-300">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className={`text-2xl font-display font-semibold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Settings
              </h2>
              <p className={`text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Customize your CoPilotX experience
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all duration-300 popup-hover ${
              darkMode 
                ? 'glass text-white/70 hover:text-white hover:bg-white/10' 
                : 'bg-white/50 text-gray-600 hover:text-gray-900 hover:bg-white/80'
            }`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Settings Sections */}
        <div className="space-y-8">
          {/* Appearance */}
          <div className={`rounded-xl p-6 transition-all duration-300 popup-hover ${
            darkMode ? 'glass-dark' : 'bg-white/50 backdrop-blur-sm border border-gray-200/30'
          }`}>
            <h3 className={`text-lg font-display font-semibold mb-4 flex items-center ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-neon-blue to-neon-cyan flex items-center justify-center mr-3 scale-hover transition-all duration-300">
                {darkMode ? <Moon className="w-4 h-4 text-white" /> : <Sun className="w-4 h-4 text-white" />}
              </div>
              Appearance
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className={`text-sm font-medium ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Theme Mode
                  </label>
                  <p className={`text-xs ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Choose between light and dark themes
                  </p>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-neon-blue focus:ring-offset-2 ${
                    darkMode ? 'bg-neon-blue' : 'bg-gray-300'
                  } ${darkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* AI Analysis */}
          <div className={`rounded-xl p-6 transition-all duration-300 popup-hover ${
            darkMode ? 'glass-dark' : 'bg-white/50 backdrop-blur-sm border border-gray-200/30'
          }`}>
            <h3 className={`text-lg font-display font-semibold mb-4 flex items-center ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-neon-green to-neon-cyan flex items-center justify-center mr-3 scale-hover transition-all duration-300">
                <Zap className="w-4 h-4 text-white" />
              </div>
              AI Analysis
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className={`text-sm font-medium block mb-2 ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Analysis Detail Level
                </label>
                <select
                  value={analyticsLevel}
                  onChange={(e) => setAnalyticsLevel(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all duration-300 ${
                    darkMode 
                      ? 'glass-dark text-white' 
                      : 'bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-900'
                  }`}
                >
                  <option value="basic">Basic Analysis</option>
                  <option value="detailed">Detailed Analysis</option>
                  <option value="comprehensive">Comprehensive Analysis</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className={`text-sm font-medium ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Auto-save Responses
                  </label>
                  <p className={`text-xs ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Automatically save AI responses locally
                  </p>
                </div>
                <button
                  onClick={() => setAutoSave(!autoSave)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-neon-blue focus:ring-offset-2 ${
                    autoSave ? 'bg-neon-green' : 'bg-gray-300'
                  } ${darkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                      autoSave ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className={`rounded-xl p-6 transition-all duration-300 popup-hover ${
            darkMode ? 'glass-dark' : 'bg-white/50 backdrop-blur-sm border border-gray-200/30'
          }`}>
            <h3 className={`text-lg font-display font-semibold mb-4 flex items-center ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-neon-pink to-neon-purple flex items-center justify-center mr-3 scale-hover transition-all duration-300">
                <Bell className="w-4 h-4 text-white" />
              </div>
              Notifications
            </h3>
            
            <div className="flex items-center justify-between">
              <div>
                <label className={`text-sm font-medium ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Browser Notifications
                </label>
                <p className={`text-xs ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Get notified when analysis is complete
                </p>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-neon-blue focus:ring-offset-2 ${
                  notifications ? 'bg-neon-pink' : 'bg-gray-300'
                } ${darkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Data Management */}
          <div className={`rounded-xl p-6 transition-all duration-300 popup-hover ${
            darkMode ? 'glass-dark' : 'bg-white/50 backdrop-blur-sm border border-gray-200/30'
          }`}>
            <h3 className={`text-lg font-display font-semibold mb-4 flex items-center ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-neon-purple to-neon-blue flex items-center justify-center mr-3 scale-hover transition-all duration-300">
                <Download className="w-4 h-4 text-white" />
              </div>
              Data Management
            </h3>
            
            <div className="space-y-4">
              <button
                onClick={handleExportData}
                className={`w-full btn-futuristic flex items-center justify-center px-4 py-3 rounded-lg transition-all duration-300 scale-hover hover-glow-blue ${
                  darkMode 
                    ? 'text-white/90 hover:text-white' 
                    : 'text-gray-700 hover:text-gray-900 bg-white/50 hover:bg-white/80'
                }`}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Settings
              </button>
              
              <button
                onClick={handleClearData}
                className={`w-full btn-futuristic flex items-center justify-center px-4 py-3 rounded-lg transition-all duration-300 scale-hover hover-glow-pink border-red-500/30 hover:border-red-500/60 ${
                  darkMode 
                    ? 'text-red-400 hover:text-red-300' 
                    : 'text-red-600 hover:text-red-700 bg-red-50/50 hover:bg-red-50/80'
                }`}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Data
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`mt-8 pt-6 border-t text-center ${
          darkMode ? 'border-white/10' : 'border-gray-200/50'
        }`}>
          <p className={`text-xs ${
            darkMode ? 'text-gray-500' : 'text-gray-400'
          }`}>
            CoPilotX v1.0.0 • Settings are saved automatically
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;