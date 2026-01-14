
import React, { useState, useEffect, useRef } from 'react';
import { Note, TimetableEvent } from '../../types';
import { Search, Save, Calendar, User, AlignLeft, Info, BookOpen, ChevronDown, Trash2, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale/vi';
import { enUS } from 'date-fns/locale/en-US';

interface NoteManagerProps {
  notes: Note[];
  events: TimetableEvent[];
  onSaveNote: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  darkMode: boolean;
  language: 'en' | 'vi';
  t: any;
}

const NoteManager: React.FC<NoteManagerProps> = ({ notes, events, onSaveNote, onDeleteNote, darkMode, language, t }) => {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [editingContent, setEditingContent] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderAt, setReminderAt] = useState('');
  const [search, setSearch] = useState('');
  const [isEventMenuOpen, setIsEventMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const currentLocale = language === 'vi' ? vi : enUS;
  const localNow = new Date();
  localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset());
  const nowIso = localNow.toISOString().slice(0,16);

  const showToast = (message: string, type: 'success' | 'error' = 'success', duration = 3000) => {
    setToast({ message, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), duration);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const isPast = (dateValue: string) => {
    const date = new Date(dateValue);
    return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
  };

  const toInputValue = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return nowIso;
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };

  // Sync content when selected event changes
  useEffect(() => {
    if (selectedEventId) {
      const existingNote = notes.find(n => n.eventId === selectedEventId);
      if (existingNote) {
        setSelectedNoteId(existingNote.id);
        setEditingContent(existingNote.content);
        setReminderEnabled(!!existingNote.reminderEnabled);
        setReminderAt(existingNote.reminderAt ? toInputValue(existingNote.reminderAt) : nowIso);
      } else {
        setSelectedNoteId(null);
        setEditingContent('');
        setReminderEnabled(false);
        setReminderAt(nowIso);
      }
    }
  }, [selectedEventId, notes]);

  useEffect(() => {
    if (!isEventMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEventMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsEventMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isEventMenuOpen]);

  // Initial selection logic
  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  const handleSave = () => {
    if (!selectedEventId) return;
    let reminderAtValue: string | undefined;
    if (reminderEnabled) {
      if (isPast(reminderAt)) {
        showToast(t.reminderPastError, 'error');
        return;
      }
      const reminderDate = new Date(reminderAt);
      if (Number.isNaN(reminderDate.getTime())) {
        showToast(t.reminderPastError, 'error');
        return;
      }
      reminderAtValue = reminderDate.toISOString();
    }
    const note: Note = {
      id: selectedNoteId || Date.now().toString(),
      eventId: selectedEventId,
      content: editingContent,
      updatedAt: new Date().toISOString(),
      reminderEnabled,
      reminderAt: reminderEnabled ? reminderAtValue : undefined
    };
    onSaveNote(note);
    setSelectedNoteId(note.id);
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredNotes = notes.filter(n => {
    const event = events.find(e => e.id === n.eventId);
    return (
        event?.title.toLowerCase().includes(normalizedSearch) || 
        n.content.toLowerCase().includes(normalizedSearch) ||
        event?.code?.toLowerCase().includes(normalizedSearch)
    );
  });

  const activeEvent = events.find(e => e.id === selectedEventId);
  const activeEventDate = activeEvent?.startDate ? new Date(activeEvent.startDate) : new Date();

  return (
    <div className="h-[calc(100vh-140px)] flex gap-8 overflow-hidden max-w-7xl mx-auto">
      {toast && (
        <>
          <style>{`@keyframes toast-slide { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
          <div
            className={`fixed top-6 right-6 z-[9999] px-4 py-3 rounded-xl shadow-2xl border text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-rose-100 text-rose-800 border-rose-200'
            }`}
            style={{ animation: 'toast-slide 0.3s ease-out', pointerEvents: 'none' }}
          >
            {toast.message}
          </div>
        </>
      )}
      {/* Sidebar List */}
      <div className={`w-96 flex-shrink-0 flex flex-col bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden`}>
        <div className="p-6 border-b dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
           <h3 className="text-xl font-black mb-4 tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
             <BookOpen className="w-5 h-5 text-blue-600" /> {t.studyJournal}
           </h3>
           <div className="relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <input 
               type="text" 
               placeholder={t.searchContent} 
               value={search} 
               onChange={(e) => setSearch(e.target.value)} 
               className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 dark:text-white" 
             />
           </div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {filteredNotes.length > 0 && filteredNotes.map(note => {
            const event = events.find(e => e.id === note.eventId);
            const isActive = selectedEventId === note.eventId;
            return (
              <div key={note.id} className="relative">
                <button 
                  onClick={() => setSelectedEventId(note.eventId)} 
                  className={`w-full text-left p-6 pr-14 border-b dark:border-slate-700 transition-all ${
                    isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 z-10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-blue-100' : 'text-blue-600'}`}>{event?.code || 'GEN'}</span>
                      {note.reminderEnabled && (
                        <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 ${isActive ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-600'}`}>
                          <Bell className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold ${isActive ? 'text-blue-100/60' : 'text-slate-400'}`}>
                      {format(new Date(note.updatedAt), 'd MMM', { locale: currentLocale })}
                    </span>
                  </div>
                  <h5 className="font-black text-[15px] mb-2 truncate tracking-tight">{event?.title || t.untitled}</h5>
                  <p className={`text-xs line-clamp-2 leading-relaxed font-medium ${isActive ? 'text-blue-50' : 'text-slate-500'}`}>{note.content || t.clickToWrite}</p>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteNote(note);
                  }}
                  className={`absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                    isActive ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50'
                  }`}
                  title={t.deleteNote}
                  aria-label={t.deleteNote}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          {filteredNotes.length === 0 && (
            <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                    <AlignLeft className="w-8 h-8" />
                </div>
                <p className="text-slate-400 font-bold">{t.noRecords}</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
        <div className="p-8 border-b dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
           <div className="flex-1 min-w-0">
              <>
                <div className="flex items-center gap-4">
                  <div ref={dropdownRef} className="relative max-w-full">
                    <button
                      type="button"
                      disabled={events.length === 0}
                      onClick={() => setIsEventMenuOpen(prev => !prev)}
                      className="group flex items-center gap-3 max-w-full rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-4 py-2.5 text-left shadow-sm transition-all hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-haspopup="listbox"
                      aria-expanded={isEventMenuOpen}
                    >
                      <span className="text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">
                        {activeEvent ? activeEvent.title : t.chooseSubject}
                      </span>
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isEventMenuOpen ? 'rotate-180 text-blue-600' : ''}`} />
                    </button>

                    {isEventMenuOpen && (
                      <div className="absolute left-0 mt-2 w-[min(420px,80vw)] rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-2xl z-30 overflow-hidden backdrop-blur">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                          {t.chooseSubject}
                        </div>
                        <div className="max-h-72 overflow-auto no-scrollbar py-2">
                          {events.map(event => (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => {
                                setSelectedEventId(event.id);
                                setIsEventMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors rounded-xl mx-2 ${
                                selectedEventId === event.id
                                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="truncate block">{event.title}</span>
                                {event.startDate && (
                                  <span className={`mt-1 block text-[11px] font-bold uppercase tracking-wide ${
                                    selectedEventId === event.id ? 'text-blue-100/70' : 'text-slate-400'
                                  }`}>
                                    {format(new Date(event.startDate), 'dd/MM/yyyy', { locale: currentLocale })}
                                  </span>
                                )}
                              </div>
                              {event.code && (
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                                  selectedEventId === event.id ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
                                }`}>
                                  {event.code}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {activeEvent && <span className="text-xs font-black text-white px-3 py-1 rounded-full shadow-sm flex-shrink-0" style={{backgroundColor: activeEvent.color}}>{activeEvent.code}</span>}
                </div>
                {activeEvent && (
                  <div className="flex items-center gap-6 text-[11px] font-black text-slate-400 mt-2 uppercase tracking-widest overflow-hidden">
                    <span className="flex items-center gap-2 whitespace-nowrap"><Calendar className="w-4 h-4" /> {format(activeEventDate, 'EEEE, dd/MM/yyyy', { locale: currentLocale })}</span>
                    <span className="flex items-center gap-2 truncate"><User className="w-4 h-4 flex-shrink-0" /> {activeEvent.instructor}</span>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 shadow-sm">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{t.reminderToggle}</span>
                    <label className="inline-flex items-center cursor-pointer gap-2">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={reminderEnabled}
                        disabled={!selectedEventId}
                        onChange={(ev) => {
                          const nextEnabled = ev.target.checked;
                          if (!nextEnabled) {
                            setReminderEnabled(false);
                            return;
                          }
                          setReminderEnabled(true);
                          if (!reminderAt) {
                            setReminderAt(nowIso);
                          }
                        }}
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors ${reminderEnabled ? 'bg-blue-600' : 'bg-slate-300'} ${!selectedEventId ? 'opacity-60' : ''}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${reminderEnabled ? 'translate-x-5' : 'translate-x-1'}`}></div>
                      </div>
                    </label>
                  </div>
                  {reminderEnabled && (
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">{t.reminderTime}</label>
                      <input
                        type="datetime-local"
                        value={reminderAt}
                        min={nowIso}
                        disabled={!selectedEventId}
                        onChange={(event) => {
                          if (isPast(event.target.value)) {
                            showToast(t.reminderPastError, 'error');
                            return;
                          }
                          setReminderAt(event.target.value);
                        }}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              </>
           </div>
           <button 
             onClick={handleSave} 
             className="flex-shrink-0 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg active:scale-95 text-sm ml-4"
           >
             <Save className="w-5 h-5" /> {t.save}
           </button>
        </div>
        
        <div className="flex-1 p-10 relative">
           {!selectedEventId && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-800/90 z-10 backdrop-blur-sm">
               <Info className="w-12 h-12 text-blue-500 mb-4" />
               <p className="font-black text-slate-500 text-xl text-center px-4">{t.selectSubjectPrompt}</p>
             </div>
           )}
           <textarea 
             value={editingContent} 
             onChange={(e) => setEditingContent(e.target.value)} 
             className="w-full h-full bg-transparent border-none outline-none resize-none text-slate-800 dark:text-slate-200 font-medium leading-relaxed text-lg no-scrollbar" 
             placeholder={t.clickToWrite}
           />
        </div>
      </div>
    </div>
  );
};

export default NoteManager;
