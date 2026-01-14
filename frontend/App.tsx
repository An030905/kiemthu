
import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [language, setLanguage] = useState<'en' | 'vi'>(() => {
    const savedLanguage = localStorage.getItem('language') as 'en' | 'vi';
    return savedLanguage || 'vi';
  });
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const resetToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token') || params.get('resetToken');
  }, [location.search]);

  const TAB_ROUTES: Record<string, string> = {
    dashboard: '/dashboard',
    timetable: '/timetable',
    tasks: '/tasks',
    notes: '/notes',
    reminders: '/reminders',
    profile: '/profile'
  };
  const ROUTE_TABS: Record<string, string> = {
    '/': 'dashboard',
    '/dashboard': 'dashboard',
    '/timetable': 'timetable',
    '/tasks': 'tasks',
    '/notes': 'notes',
    '/reminders': 'reminders',
    '/profile': 'profile'
  };
  const activeTab = ROUTE_TABS[location.pathname] || 'dashboard';

  const t = TRANSLATIONS[language];

  useEffect(() => {
    if (user) {
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
      setEvents(eventsData.map((e: any) => ({ ...e, id: e.id || e._id })));
      setTasks(tasksData.map((t: any) => ({ ...t, id: t.id || t._id })));
      setNotes(notesData.map((n: any) => ({ ...n, id: n.id || n._id })));
    } catch (err) {
      // Unauthorized -> force logout
      if ((err as any)?.code === 401) {
        handleLogout();
      } else {
        console.error('Error fetching data:', err);
      }
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
    if (location.pathname === '/login' || location.pathname === '/reset') {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setEvents([]);
    setTasks([]);
    setNotes([]);
    navigate('/login', { replace: true });
  };

  const addEvent = async (event: any) => {
    const newEvent = await api.events.create(event);
    setEvents(prev => [...prev, { ...newEvent, id: newEvent.id || newEvent._id }]);
    return { ...newEvent, id: newEvent.id || newEvent._id };
  };

  const deleteEvent = async (id: string) => {
    await api.events.delete(id);
    setEvents(prev => prev.filter(e => e._id !== id && e.id !== id));
  };

  const updateEvent = async (id: string, updates: any) => {
    const updated = await api.events.update(id, updates);
    setEvents(prev => prev.map(ev => {
      const evId = ev.id || (ev as any)._id;
      return evId === id ? { ...updated, id: updated.id || updated._id || evId } : ev;
    }));
  };

  const addTask = async (task: any) => {
    const newTask = await api.tasks.create(task);
    setTasks(prev => [...prev, { ...newTask, id: newTask.id || newTask._id }]);
  };

  const updateTask = async (id: string, updates: any) => {
    const updated = await api.tasks.update(id, updates);
    setTasks(prev => prev.map(t => {
      const taskId = t._id || t.id;
      return taskId === id ? { ...updated, id: updated.id || updated._id || taskId } : t;
    }));
  };

  const deleteTask = async (id: string) => {
    await api.tasks.delete(id);
    setTasks(prev => prev.filter(t => t._id !== id && t.id !== id));
  };

  const saveNote = async (note: any) => {
    const saved = await api.notes.save(note);
    const normalized = { ...saved, id: saved.id || saved._id };
    setNotes(prev => {
      const exists = prev.find(n => n.eventId === note.eventId);
      if (exists) return prev.map(n => n.eventId === note.eventId ? normalized : n);
      return [...prev, normalized];
    });
  };

  const deleteNote = async (note: Note) => {
    const noteId = note._id || note.id;
    await api.notes.delete(noteId);
    setNotes(prev => prev.filter(n => (n._id || n.id) !== noteId));
  };

  const handleUpdateUser = async (updatedUser: User) => {
    const userFromApi = await api.user.updateProfile(updatedUser);
    setUser(userFromApi);
    localStorage.setItem('user', JSON.stringify(userFromApi));
  };

  const handleTabChange = (tab: string) => {
    const nextPath = TAB_ROUTES[tab] || '/dashboard';
    if (location.pathname !== nextPath) {
      navigate(nextPath);
    }
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    if (user) {
      if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/reset') {
        navigate('/dashboard', { replace: true });
      }
      return;
    }
    if (!resetToken && location.pathname === '/') {
      navigate('/login', { replace: true });
    }
  }, [user, location.pathname, resetToken, navigate]);

  if (resetToken) {
    return (
      <AuthForm
        onLogin={handleLogin}
        t={t}
        resetToken={resetToken}
        onResetComplete={() => navigate('/login', { replace: true })}
      />
    );
  }

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
          onNotificationClick={() => handleTabChange('reminders')}
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
                <Dashboard user={user} events={events} tasks={tasks} onNavigate={handleTabChange} language={language} t={t} />
              )}
              {activeTab === 'timetable' && (
                <Timetable 
                  events={events} notes={notes} onSaveNote={saveNote}
                  onAddEvent={addEvent} onDeleteEvent={deleteEvent}
                  onUpdateEvent={updateEvent} darkMode={darkMode} language={language} t={t}
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
                  notes={notes} events={events} onSaveNote={saveNote} onDeleteNote={deleteNote}
                  darkMode={darkMode} language={language} t={t}
                />
              )}
              {activeTab === 'reminders' && (
                <Reminders 
                  tasks={tasks} 
                  events={events} 
                  darkMode={darkMode} 
                  t={t} 
                  onUpdateTask={updateTask} 
                  language={language}
                  notificationChannels={user.notificationChannels || ['EMAIL']}
                />
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
