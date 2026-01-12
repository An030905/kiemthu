
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './components/Dashboard/Dashboard';
import Timetable from './components/Timetable/Timetable';
import TaskManager from './components/Tasks/TaskManager';
import NoteManager from './components/Notes/NoteManager';
import Reminders from './components/Reminders/Reminders';
import Profile from './components/Auth/Profile';
import AuthForm from './components/Auth/AuthForm';
import { User, TimetableEvent, Task, Note } from './types';
import { TRANSLATIONS } from './constants';
import { api } from './services/api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState<'en' | 'vi'>('vi');
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    const savedLanguage = localStorage.getItem('language') as 'en' | 'vi';
    const savedUser = localStorage.getItem('user');

    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedLanguage) setLanguage(savedLanguage);
    setDarkMode(savedDarkMode);

    if (savedUser) {
      fetchInitialData();
    }
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [eventsData, tasksData, notesData] = await Promise.all([
        api.events.getAll(),
        api.tasks.getAll(),
        api.notes.getAll()
      ]);
      setEvents(eventsData);
      setTasks(tasksData);
      setNotes(notesData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('bg-slate-900', 'text-white');
      document.body.classList.remove('bg-slate-50', 'text-slate-900');
    } else {
      document.body.classList.remove('bg-slate-900', 'text-white');
      document.body.classList.add('bg-slate-50', 'text-slate-900');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const handleLogin = (u: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    fetchInitialData();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setEvents([]);
    setTasks([]);
    setNotes([]);
    setActiveTab('dashboard');
  };

  const addEvent = async (event: any) => {
    const newEvent = await api.events.create(event);
    setEvents(prev => [...prev, newEvent]);
  };

  const deleteEvent = async (id: string) => {
    await api.events.delete(id);
    setEvents(prev => prev.filter(e => e._id !== id && e.id !== id));
  };

  const addTask = async (task: any) => {
    const newTask = await api.tasks.create(task);
    setTasks(prev => [...prev, newTask]);
  };

  const updateTask = async (id: string, updates: any) => {
    const updated = await api.tasks.update(id, updates);
    setTasks(prev => prev.map(t => (t._id === id || t.id === id) ? updated : t));
  };

  const deleteTask = async (id: string) => {
    await api.tasks.delete(id);
    setTasks(prev => prev.filter(t => t._id !== id && t.id !== id));
  };

  const saveNote = async (note: any) => {
    const saved = await api.notes.save(note);
    setNotes(prev => {
      const exists = prev.find(n => n.eventId === note.eventId);
      if (exists) return prev.map(n => n.eventId === note.eventId ? saved : n);
      return [...prev, saved];
    });
  };

  const handleUpdateUser = async (updatedUser: User) => {
    const userFromApi = await api.user.updateProfile(updatedUser);
    setUser(userFromApi);
    localStorage.setItem('user', JSON.stringify(userFromApi));
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  if (!user) {
    return <AuthForm onLogin={handleLogin} t={t} />;
  }

  return (
    <div className={`flex min-h-screen ${darkMode ? 'dark' : ''}`}>
      {/* Overlay for mobile sidebar */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        onLogout={handleLogout} 
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
        language={language}
        setLanguage={setLanguage}
        t={t}
        isMobileOpen={isMobileMenuOpen}
      />
      
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header 
          activeTab={activeTab} 
          user={user} 
          onNotificationClick={() => setActiveTab('reminders')}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          darkMode={darkMode}
          t={t}
        />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard user={user} events={events} tasks={tasks} onNavigate={setActiveTab} language={language} t={t} />
              )}
              {activeTab === 'timetable' && (
                <Timetable 
                  events={events} onAddEvent={addEvent} onDeleteEvent={deleteEvent}
                  onUpdateEvent={(id, updates) => {
                    const existing = events.find(e => e.id === id || e._id === id);
                    if (existing) {
                        // For simplicity in this session, using functional update if needed
                    }
                  }} darkMode={darkMode} language={language} t={t}
                />
              )}
              {activeTab === 'tasks' && (
                <TaskManager 
                  tasks={tasks} events={events} onAddTask={addTask} onUpdateTask={updateTask} 
                  onDeleteTask={deleteTask} darkMode={darkMode} language={language} t={t}
                />
              )}
              {activeTab === 'notes' && (
                <NoteManager 
                  notes={notes} events={events} onSaveNote={saveNote}
                  darkMode={darkMode} language={language} t={t}
                />
              )}
              {activeTab === 'reminders' && (
                <Reminders tasks={tasks} events={events} darkMode={darkMode} t={t} />
              )}
              {activeTab === 'profile' && (
                <Profile user={user} onUpdateUser={handleUpdateUser} darkMode={darkMode} t={t} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
