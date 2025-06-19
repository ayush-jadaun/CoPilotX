import { Calendar, MapPin, Users, Target, Zap, TrendingUp } from 'lucide-react';

const Sidebar = ({ darkMode = true }) => {
  return (
    <div className={`rounded-2xl p-6 sticky top-24 card-popup hover-glow-purple transition-all duration-300 ${
      darkMode 
        ? 'glass-card' 
        : 'bg-white/70 backdrop-blur-md border border-gray-200/50 shadow-lg'
    }`}>
      <div className="flex items-center mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink flex items-center justify-center neon-purple mr-3 scale-hover transition-all duration-300">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className={`text-lg font-display font-semibold ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Startup Timeline
          </h3>
          <p className={`text-xs ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>Canvas View</p>
        </div>
      </div>
      
      <div className={`text-sm text-neon-blue mb-6 flex items-center ${
        darkMode ? '' : 'text-blue-600'
      }`}>
        <Zap className="w-4 h-4 mr-2" />
        <span>Coming Soon</span>
      </div>
      
      <div className="space-y-4">
        <div className={`rounded-xl p-4 border border-green-500/20 hover:border-green-500/40 transition-all duration-300 popup-hover ${
          darkMode ? 'glass-dark' : 'bg-green-50/80 backdrop-blur-sm'
        }`}>
          <div className="flex items-center mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 scale-hover transition-all duration-300 ${
              darkMode ? 'bg-green-500/20' : 'bg-green-200'
            }`}>
              <Target className={`w-4 h-4 ${
                darkMode ? 'text-green-400' : 'text-green-600'
              }`} />
            </div>
            <span className={`text-sm font-medium ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Phase 1: Ideation
            </span>
          </div>
          <p className={`text-xs leading-relaxed ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Define concept and validate market fit
          </p>
          <div className={`mt-3 w-full rounded-full h-2 ${
            darkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`}>
            <div className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full w-3/4 transition-all duration-500"></div>
          </div>
        </div>
        
        <div className={`rounded-xl p-4 opacity-60 hover:opacity-80 transition-all duration-300 popup-hover ${
          darkMode ? 'glass-dark' : 'bg-blue-50/80 backdrop-blur-sm'
        }`}>
          <div className="flex items-center mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 scale-hover transition-all duration-300 ${
              darkMode ? 'bg-blue-500/20' : 'bg-blue-200'
            }`}>
              <Users className={`w-4 h-4 ${
                darkMode ? 'text-blue-400' : 'text-blue-600'
              }`} />
            </div>
            <span className={`text-sm font-medium ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Phase 2: Team Building
            </span>
          </div>
          <p className={`text-xs leading-relaxed ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Assemble core team and advisors
          </p>
          <div className={`mt-3 w-full rounded-full h-2 ${
            darkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`}>
            <div className="bg-gradient-to-r from-blue-400 to-blue-500 h-2 rounded-full w-1/4 transition-all duration-500"></div>
          </div>
        </div>
        
        <div className={`rounded-xl p-4 opacity-40 hover:opacity-60 transition-all duration-300 popup-hover ${
          darkMode ? 'glass-dark' : 'bg-purple-50/80 backdrop-blur-sm'
        }`}>
          <div className="flex items-center mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 scale-hover transition-all duration-300 ${
              darkMode ? 'bg-purple-500/20' : 'bg-purple-200'
            }`}>
              <MapPin className={`w-4 h-4 ${
                darkMode ? 'text-purple-400' : 'text-purple-600'
              }`} />
            </div>
            <span className={`text-sm font-medium ${
              darkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Phase 3: MVP Development
            </span>
          </div>
          <p className={`text-xs leading-relaxed ${
            darkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Build and test minimum viable product
          </p>
          <div className={`mt-3 w-full rounded-full h-2 ${
            darkMode ? 'bg-gray-700' : 'bg-gray-200'
          }`}>
            <div className="bg-gradient-to-r from-purple-400 to-purple-500 h-2 rounded-full w-0 transition-all duration-500"></div>
          </div>
        </div>
      </div>
      
      <div className={`mt-8 rounded-xl p-4 border border-neon-blue/20 popup-hover transition-all duration-300 ${
        darkMode ? 'glass-dark' : 'bg-blue-50/80 backdrop-blur-sm'
      }`}>
        <div className="flex items-center mb-3">
          <TrendingUp className={`w-5 h-5 mr-2 ${
            darkMode ? 'text-neon-blue' : 'text-blue-600'
          }`} />
          <span className={`text-sm font-medium ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>Pro Tip</span>
        </div>
        <p className={`text-xs leading-relaxed ${
          darkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Visual roadmap and milestone tracking will be available in the next update. 
          Get ready for an interactive startup journey!
        </p>
      </div>
    </div>
  );
};

export default Sidebar;