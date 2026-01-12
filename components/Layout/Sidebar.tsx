
import React from 'react';
import { NAV_ITEMS } from '../../constants';
import { LogOut, Sun, Moon, Globe, X } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  onLogout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  language: 'en' | 'vi';
  setLanguage: (lang: 'en' | 'vi') => void;
  t: any;
  isMobileOpen?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, onTabChange, onLogout, darkMode, toggleDarkMode, language, setLanguage, t, isMobileOpen 
}) => {
  const sidebarClasses = `
    fixed inset-y-0 left-0 z-50 w-72 flex-shrink-0 flex flex-col border-r transition-all duration-300 transform
    md:relative md:translate-x-0 md:flex
    ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
    ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
  `;

  return (
    <aside className={sidebarClasses}>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/30">
            U
          </div>
          <span className={`text-xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>UniFlow</span>
        </div>
        {/* Close button for mobile */}
        {isMobileOpen && (
          <button 
            onClick={() => onTabChange(activeTab)} 
            className={`md:hidden p-2 rounded-lg ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-50 text-slate-500'}`}
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto no-scrollbar">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 ${
              activeTab === item.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                : `${darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'}`
            }`}
          >
            <span className={activeTab === item.id ? 'text-white' : 'text-current'}>{item.icon}</span>
            <span className="font-bold">{t[item.labelKey]}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
          darkMode ? 'text-slate-400' : 'text-slate-600'
        }`}>
          <Globe className="w-5 h-5" />
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex-1">
            <button 
              onClick={() => setLanguage('en')}
              className={`flex-1 text-[10px] font-black py-2 rounded-md transition-all ${language === 'en' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              ENGLISH
            </button>
            <button 
              onClick={() => setLanguage('vi')}
              className={`flex-1 text-[10px] font-black py-2 rounded-md transition-all ${language === 'vi' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              TIẾNG VIỆT
            </button>
          </div>
        </div>

        <button
          onClick={toggleDarkMode}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
            darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'
          }`}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="font-bold">{darkMode ? t.lightMode : t.darkMode}</span>
        </button>
        
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10`}
        >
          <LogOut className="w-5 h-5" />
          <span className="font-bold">{t.signOut}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
