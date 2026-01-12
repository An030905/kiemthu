
import React from 'react';
import { User } from '../../types';
import { NAV_ITEMS } from '../../constants';
import { Bell, Menu } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  user: User;
  onNotificationClick: () => void;
  onMenuClick?: () => void;
  darkMode: boolean;
  t: any;
}

const Header: React.FC<HeaderProps> = ({ activeTab, user, onNotificationClick, onMenuClick, darkMode, t }) => {
  const currentNav = NAV_ITEMS.find(i => i.id === activeTab);

  return (
    <header className={`h-20 flex-shrink-0 flex items-center justify-between px-4 md:px-8 border-b transition-all duration-200 sticky top-0 z-30 ${
      darkMode ? 'bg-slate-900/80 border-slate-800 backdrop-blur-xl' : 'bg-white/80 border-slate-200 backdrop-blur-xl'
    }`}>
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className={`md:hidden p-2 rounded-xl transition-colors ${
            darkMode ? 'hover:bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-900'
          }`}
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className={`text-xl md:text-2xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          {currentNav ? t[currentNav.labelKey] : t.dashboard}
        </h1>
      </div>

      <div className="flex items-center gap-3 md:gap-6">
        <button 
          onClick={onNotificationClick}
          className={`relative p-2.5 rounded-full transition-all ${
            darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <Bell className="w-6 h-6" />
          <span className="absolute top-2.5 right-2.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>
        </button>

        <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="text-right hidden sm:block">
            <div className={`text-sm font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{user.fullName}</div>
            <div className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{user.major}</div>
          </div>
          <img 
            src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fullName}`} 
            alt="Profile" 
            className="w-10 h-10 rounded-xl border-2 border-blue-500 object-cover shadow-lg shadow-blue-500/20"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
