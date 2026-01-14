
import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, TimetableEvent } from '../../types';
import { Plus, Search, Trash2, Calendar, CheckCircle2, Circle, X, AlignLeft, Flag, Info, Bell, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
// Fix: Use subpath imports for locales to ensure compatibility with different date-fns versions and strict TS environments
import { vi } from 'date-fns/locale/vi';
import { enUS } from 'date-fns/locale/en-US';

interface TaskManagerProps {
  tasks: Task[];
  events: TimetableEvent[];
  onAddTask: (task: Task) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  darkMode: boolean;
  language: 'en' | 'vi';
  t: any;
}

const TaskManager: React.FC<TaskManagerProps> = ({ tasks, events, onAddTask, onUpdateTask, onDeleteTask, darkMode, language, t }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState<number>(0);
  const [reminderMode, setReminderMode] = useState<'auto' | 'manual'>('manual');
  const [manualReminderAt, setManualReminderAt] = useState('');
  const [formStatus, setFormStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const dueDateRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const localNow = new Date();
  localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset());
  const nowIso = localNow.toISOString().slice(0,16);

  const currentLocale = language === 'vi' ? vi : enUS;

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

  const toInputValue = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return nowIso;
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };

  const isPast = (dateValue: string) => {
    const date = new Date(dateValue);
    return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
  };

  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filter === 'ALL' || task.status === filter;
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleOpenAdd = () => {
    setEditingTask(null);
    setShowAddModal(true);
    setReminderEnabled(false);
    setReminderMinutes(30);
    setReminderMode('auto');
    setManualReminderAt(nowIso);
    setFormStatus(TaskStatus.TODO);
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setShowAddModal(true);
    setReminderEnabled(!!task.reminderEnabled);
    setReminderMinutes(task.reminderMinutesBefore ?? 0);
    setReminderMode('auto');
    setManualReminderAt(
      task.reminderAt
        ? toInputValue(task.reminderAt)
        : task.dueDate
          ? format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm")
          : nowIso
    );
    setFormStatus(task.status);
  };

  useEffect(() => {
    if (!showAddModal) return;
    if (editingTask) {
      setReminderEnabled(!!editingTask.reminderEnabled);
      setReminderMinutes(editingTask.reminderMinutesBefore ?? 0);
      setReminderMode('auto');
      setFormStatus(editingTask.status);
    } else {
      setReminderEnabled(false);
      setReminderMinutes(0);
      setReminderMode('auto');
      setFormStatus(TaskStatus.TODO);
    }
  }, [editingTask, showAddModal]);

  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isFilterOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dueDateValue = formData.get('dueDate') as string;
    const statusValue = formStatus;
    let reminderMinutesBefore: number | undefined;
    let reminderAt: string | undefined;
    if (reminderEnabled) {
      if (reminderMode === 'manual') {
        const manualDate = new Date(manualReminderAt);
        if (!Number.isNaN(manualDate.getTime())) {
          reminderAt = manualDate.toISOString();
          if (dueDateValue) {
            const diffMin = Math.round((new Date(dueDateValue).getTime() - manualDate.getTime()) / 60000);
            reminderMinutesBefore = diffMin > 0 ? diffMin : 0;
          }
        }
      } else {
        const parsedMinutes = parseInt(formData.get('reminderMinutesBefore') as string);
        reminderMinutesBefore = Number.isNaN(parsedMinutes) ? reminderMinutes : parsedMinutes;
        if (dueDateValue && reminderMinutesBefore !== undefined) {
          const ms = new Date(dueDateValue).getTime() - reminderMinutesBefore * 60 * 1000;
          if (!Number.isNaN(ms)) reminderAt = new Date(ms).toISOString();
        }
      }
    }
    if (reminderEnabled && reminderAt && new Date(reminderAt).getTime() < Date.now()) {
      showToast(t.reminderPastError, 'error');
      return;
    }
    const shouldDisableReminder = statusValue === TaskStatus.COMPLETED;
    const newTaskData: Omit<Task, 'id' | 'attachments'> = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      dueDate: dueDateValue,
      status: statusValue,
      priority: (formData.get('priority') as 'low' | 'medium' | 'high') || 'medium',
      reminderEnabled: shouldDisableReminder ? false : reminderEnabled,
      reminderMinutesBefore: shouldDisableReminder ? undefined : reminderMinutesBefore,
      reminderAt: shouldDisableReminder ? undefined : reminderAt
    };

    if (editingTask) {
      onUpdateTask(editingTask.id, newTaskData);
    } else {
      const newTask: Task = {
        ...newTaskData,
        id: Date.now().toString(),
        attachments: []
      };
      onAddTask(newTask);
    }
    setShowAddModal(false);
  };

  const getPriorityStyles = (p: string) => {
    switch(p) {
      case 'high': return 'text-red-600 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-500/20';
      case 'medium': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-500/20';
      default: return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500/20';
    }
  };

  const getStatusStyles = (s: TaskStatus) => {
    switch(s) {
      case TaskStatus.COMPLETED: return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/20';
      case TaskStatus.IN_PROGRESS: return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500/20';
      default: return 'text-slate-500 bg-slate-50 dark:bg-slate-700 ring-1 ring-slate-400/20';
    }
  };

  const getStatusText = (s: TaskStatus) => {
    switch(s) {
      case TaskStatus.COMPLETED: return t.completed;
      case TaskStatus.IN_PROGRESS: return t.inProgress;
      default: return t.todo;
    }
  };

  return (
    <div className="space-y-6">
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
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" placeholder={t.searchTasks} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 outline-none shadow-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-900 dark:text-white" />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div ref={filterRef} className="relative w-full md:w-auto">
            <button
              type="button"
              onClick={() => setIsFilterOpen(prev => !prev)}
              className="w-full md:w-auto flex items-center justify-between gap-3 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none shadow-sm font-bold text-slate-700 dark:text-slate-200 hover:border-blue-400 transition-all"
              aria-haspopup="listbox"
              aria-expanded={isFilterOpen}
            >
              <span className="truncate">
                {filter === 'ALL' ? t.allStatus : (filter === TaskStatus.TODO ? t.todo : filter === TaskStatus.IN_PROGRESS ? t.inProgress : t.completed)}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180 text-blue-600' : ''}`} />
            </button>
            {isFilterOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-2xl z-30 overflow-hidden backdrop-blur">
                <div className="px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  {t.allStatus}
                </div>
                <div className="py-2">
                  {[
                    { value: 'ALL' as const, label: t.allStatus },
                    { value: TaskStatus.TODO, label: t.todo },
                    { value: TaskStatus.IN_PROGRESS, label: t.inProgress },
                    { value: TaskStatus.COMPLETED, label: t.completed }
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setFilter(option.value);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                        filter === option.value
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-md active:scale-95 transition-all"><Plus className="w-5 h-5" /> {t.newTask}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTasks.length > 0 ? filteredTasks.map(task => (
          <div 
            key={task.id} 
            onClick={() => handleOpenEdit(task)}
            className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group flex flex-col h-full cursor-pointer"
          >
            <div className="flex justify-between items-start mb-4">
               <div className="flex items-start gap-3 flex-1 min-w-0">
                 <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextStatus = task.status === TaskStatus.COMPLETED ? TaskStatus.TODO : TaskStatus.COMPLETED;
                    onUpdateTask(task.id, nextStatus === TaskStatus.COMPLETED
                      ? { status: nextStatus, reminderEnabled: false, reminderMinutesBefore: undefined, reminderAt: undefined }
                      : { status: nextStatus }
                    );
                  }} 
                   className={`mt-0.5 transition-colors ${task.status === TaskStatus.COMPLETED ? 'text-emerald-500' : 'text-slate-300 hover:text-blue-500'}`}
                 >
                   {task.status === TaskStatus.COMPLETED ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                 </button>
                 <div className="flex-1 min-w-0">
                    <h4 className={`font-bold text-lg leading-tight truncate ${task.status === TaskStatus.COMPLETED ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>{task.title}</h4>
                    <p className="text-slate-500 text-sm mt-1 line-clamp-2 leading-relaxed font-medium">{task.description}</p>
                 </div>
               </div>
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   onDeleteTask(task.id);
                 }} 
                 className="text-slate-300 hover:text-red-500 transition-colors p-1.5 opacity-0 group-hover:opacity-100"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
            </div>
            
              <div className="mt-auto pt-4 border-t border-slate-50 dark:border-slate-700 flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(task.dueDate), 'd MMM, p', { locale: currentLocale })}
                </div>
                {task.reminderEnabled && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg w-max">
                    <Bell className="w-4 h-4" />
                    <span>{language === 'vi' ? `Nhắc trước ${task.reminderMinutesBefore || reminderMinutes} ${t.minutesShort}` : `Reminder ${task.reminderMinutesBefore || reminderMinutes} ${t.minutesShort}`}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black px-3 py-1.5 rounded-md uppercase tracking-tighter ${getStatusStyles(task.status)}`}>
                    {getStatusText(task.status)}
                  </span>
                  <span className={`text-[10px] font-black px-3 py-1.5 rounded-md uppercase tracking-tighter ${getPriorityStyles(task.priority)}`}>
                  {(t[task.priority] || task.priority).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center">
            <Flag className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">{t.noTasksFound}</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${darkMode ? 'bg-slate-800 text-white' : 'bg-white'}`}>
             <div className="px-6 py-4 border-b dark:border-slate-700 flex justify-between items-center sticky top-0 z-10 bg-inherit">
               <h3 className="text-lg font-bold uppercase tracking-tight">{editingTask ? t.editTask : t.newTask}</h3>
               <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
             </div>
             <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
               <div>
                 <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">{t.task_title.toUpperCase()}</label>
                 <input 
                   required 
                   name="title" 
                   defaultValue={editingTask?.title || ''}
                   className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900 dark:text-white" 
                   placeholder={t.task_title_placeholder} 
                 />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><AlignLeft className="w-3.5 h-3.5" /> {t.description.toUpperCase()}</label>
                 <textarea 
                   name="description" 
                   defaultValue={editingTask?.description || ''}
                   className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none h-28 resize-none font-medium text-slate-900 dark:text-white" 
                   placeholder={t.details_placeholder} 
                 />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">{t.deadline.toUpperCase()}</label>
                   <input 
                     required 
                     type="datetime-local" 
                     name="dueDate" 
                     defaultValue={editingTask?.dueDate ? format(new Date(editingTask.dueDate), "yyyy-MM-dd'T'HH:mm") : nowIso}
                     ref={dueDateRef}
                     onChange={(e) => {
                       if (reminderEnabled && reminderMode === 'manual') {
                         if (isPast(manualReminderAt)) {
                           showToast(t.reminderPastError, 'error');
                         }
                       }
                       if (reminderEnabled && reminderMode === 'auto') {
                         const reminderAt = new Date(new Date(e.target.value).getTime() - reminderMinutes * 60000);
                         if (!Number.isNaN(reminderAt.getTime()) && reminderAt.getTime() < Date.now()) {
                           showToast(t.reminderPastError, 'error');
                         }
                       }
                     }}
                     className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 outline-none font-bold text-slate-900 dark:text-white" 
                   />
                 </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">{t.priority.toUpperCase()}</label>
                  <select 
                    name="priority" 
                    defaultValue={editingTask?.priority || "medium"} 
                     className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 outline-none font-bold text-slate-900 dark:text-white"
                   >
                     <option value="low">{t.low}</option>
                     <option value="medium">{t.medium}</option>
                    <option value="high">{t.high}</option>
                  </select>
                </div>
              </div>
               {formStatus !== TaskStatus.COMPLETED && (
               <div className="mt-2 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40">
                 <div className="flex items-center justify-between gap-3">
                   <div>
                     <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide">{t.reminderToggle}</p>
                     <p className="text-xs text-slate-500 dark:text-slate-400">{language === 'vi' ? 'Bật nhắc nhở trước hạn chót' : 'Enable reminder before deadline'}</p>
                   </div>
                   <label className="inline-flex items-center cursor-pointer gap-2">
                     <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={reminderEnabled} 
                      onChange={(ev) => {
                        const nextEnabled = ev.target.checked;
                        if (!nextEnabled) {
                          setReminderEnabled(false);
                          return;
                        }
                        if (reminderMode === 'auto') {
                          const dateValue = dueDateRef.current?.value || nowIso;
                          const reminderAt = new Date(new Date(dateValue).getTime() - reminderMinutes * 60000);
                          if (!Number.isNaN(reminderAt.getTime()) && reminderAt.getTime() < Date.now()) {
                            showToast(t.reminderPastError, 'error');
                          }
                        }
                        if (reminderMode === 'manual' && !manualReminderAt) {
                          const dateValue = dueDateRef.current?.value || nowIso;
                          if (isPast(dateValue)) {
                            showToast(t.reminderPastError, 'error');
                            setManualReminderAt(nowIso);
                          }
                          setManualReminderAt(dateValue);
                        }
                        setReminderEnabled(true);
                      }} 
                      name="reminderEnabled"
                    />
                     <div className={`w-11 h-6 rounded-full transition-colors ${reminderEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}>
                       <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${reminderEnabled ? 'translate-x-5' : 'translate-x-1'}`}></div>
                     </div>
                   </label>
                 </div>
                 {reminderEnabled && (
                   <div className="mt-3 grid grid-cols-2 gap-3">
                   <div>
                     <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">{t.remindBefore}</label>
                      <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 p-1">
                        <button
                          type="button"
                          onClick={() => {
                            setReminderMode('auto');
                            const dateValue = dueDateRef.current?.value || nowIso;
                            const reminderAt = new Date(new Date(dateValue).getTime() - reminderMinutes * 60000);
                            if (!Number.isNaN(reminderAt.getTime()) && reminderAt.getTime() < Date.now()) {
                              showToast(t.reminderPastError, 'error');
                              return;
                            }
                          }}
                          className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                            reminderMode === 'auto'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {t.autoReminder}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReminderMode('manual');
                            if (!manualReminderAt) {
                              const dateValue = dueDateRef.current?.value || nowIso;
                              if (isPast(dateValue)) {
                                showToast(t.reminderPastError, 'error');
                                setManualReminderAt(nowIso);
                                return;
                              }
                              setManualReminderAt(dateValue);
                            }
                          }}
                          className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                            reminderMode === 'manual'
                              ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                              : 'text-slate-400 hover:text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {t.manualReminder}
                        </button>
                      </div>
                      {reminderMode === 'manual' ? (
                        <input
                          type="datetime-local"
                          value={manualReminderAt}
                          min={nowIso}
                          required
                          onChange={(e) => {
                            if (isPast(e.target.value)) {
                              showToast(t.reminderPastError, 'error');
                              return;
                            }
                            setManualReminderAt(e.target.value);
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 outline-none font-bold text-slate-900 dark:text-white"
                        />
                      ) : (
                        <select 
                          name="reminderMinutesBefore" 
                          value={reminderMinutes} 
                          onChange={(e) => {
                            const nextMinutes = parseInt(e.target.value) || 0;
                            const dateValue = dueDateRef.current?.value || '';
                            if (dateValue) {
                              const reminderAt = new Date(new Date(dateValue).getTime() - nextMinutes * 60000);
                              if (!Number.isNaN(reminderAt.getTime()) && reminderAt.getTime() < Date.now()) {
                                showToast(t.reminderPastError, 'error');
                                return;
                              }
                            }
                            setReminderMinutes(nextMinutes);
                          }} 
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 outline-none font-bold text-slate-900 dark:text-white"
                        >
                          {[0, 5, 15, 30, 60, 120, 240, 1440].map(min => (
                            <option key={min} value={min}>
                              {min === 0 ? (language === 'vi' ? 'Đúng giờ' : 'At due time') : `${min} ${t.minutesShort}`}
                            </option>
                          ))}
                        </select>
                      )}
                      {reminderMode === 'auto' && (
                        <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {t.autoReminderHint.replace('{minutes}', String(reminderMinutes)).replace('{unit}', t.minutesShort)}
                        </p>
                      )}
                    </div>
                     <div className="flex items-center text-sm text-slate-500 dark:text-slate-300 gap-2">
                       <Bell className="w-4 h-4 text-blue-500" />
                       <span>{language === 'vi' ? 'Sẽ nhắc trước hạn' : 'Will remind before due time'}</span>
                     </div>
                   </div>
                 )}
               </div>
               )}
               <div>
                 <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">{t.status.toUpperCase()}</label>
                 <select 
                   name="status" 
                   value={formStatus}
                   onChange={(e) => {
                     const nextStatus = e.target.value as TaskStatus;
                     setFormStatus(nextStatus);
                     if (nextStatus === TaskStatus.COMPLETED) {
                       setReminderEnabled(false);
                     }
                   }}
                   className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 outline-none font-bold text-slate-900 dark:text-white"
                 >
                   <option value={TaskStatus.TODO}>{t.todo}</option>
                   <option value={TaskStatus.IN_PROGRESS}>{t.inProgress}</option>
                   <option value={TaskStatus.COMPLETED}>{t.completed}</option>
                 </select>
               </div>
               <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
                 <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-all">{t.cancel}</button>
                 <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg active:scale-95 transition-all">{t.save}</button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManager;
