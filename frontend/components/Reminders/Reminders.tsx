import React, { useState, useEffect, useRef } from 'react';
import { Task, TimetableEvent } from '../../types';
import { Bell, Clock, Smartphone, Mail, CheckCircle2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { api } from '../../services/api';

interface RemindersProps {
  tasks: Task[];
  events: TimetableEvent[];
  darkMode: boolean;
  t: any;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  language: 'en' | 'vi';
  notificationChannels?: ('EMAIL' | 'PUSH')[];
}

type NotificationItem = {
  id?: string;
  _id?: string;
  targetType?: 'TASK' | 'EVENT' | 'NOTE';
  targetId?: string;
  status?: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELED';
  title?: string;
  sendAt?: string;
  dueDate?: string;
  remindBefore?: number;
};

const Reminders: React.FC<RemindersProps> = ({ tasks, events, darkMode, t, onUpdateTask, language, notificationChannels }) => {
  const [settings, setSettings] = useState({ push: false, email: true });
  const [typeFilter, setTypeFilter] = useState<'all' | 'task' | 'event'>('all');
  const currentLocale = language === 'vi' ? vi : enUS;
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [editingMinutes, setEditingMinutes] = useState<number>(5);
  const [editingMode, setEditingMode] = useState<'auto' | 'manual'>('manual');
  const [editingReminderAt, setEditingReminderAt] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const localNow = new Date();
  localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset());
  const nowIso = localNow.toISOString().slice(0,16);

  useEffect(() => {
    const channels = notificationChannels || ['EMAIL'];
    setSettings({
      push: channels.includes('PUSH'),
      email: channels.includes('EMAIL')
    });
  }, [notificationChannels]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await api.notifications.getAll();
        setNotifications(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Fetch notifications failed', e);
      }
    };
    fetchNotifications();
  }, []);

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

  const filterByType = (list: Task[]) => {
    if (typeFilter === 'task') return list.filter(t => !t.relatedEventId);
    if (typeFilter === 'event') return list.filter(t => !!t.relatedEventId);
    return list;
  };

  const reminderTasks = filterByType(tasks.filter(t => t.reminderEnabled && !t.reminderSent));
  const sentReminderTasks = filterByType(tasks.filter(t => t.reminderSent));
  const showNotes = typeFilter === 'all' || typeFilter === 'event';
  const pendingNoteReminders = notifications.filter(n => n.targetType === 'NOTE' && n.status === 'PENDING');
  const sentNoteReminders = notifications.filter(n => n.targetType === 'NOTE' && n.status === 'SENT');
  const reminderCount = reminderTasks.length + (showNotes ? pendingNoteReminders.length : 0);
  const sentReminderCount = sentReminderTasks.length + (showNotes ? sentNoteReminders.length : 0);
  const activeEditingTask = editingReminderId
    ? tasks.find(task => task.id === editingReminderId || (task as any)._id === editingReminderId)
    : null;

  const formatDateDisplay = (d: string) => {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return language === 'vi' ? format(date, "HH:mm dd/MM/yyyy") : format(date, 'PP p', { locale: currentLocale });
  };

  const requestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const res = await Notification.requestPermission();
    return res === 'granted';
  };

  const applyChannels = async (nextSet: Set<'EMAIL' | 'PUSH'>) => {
    try {
      const updatedUser = await api.user.updateProfile({ notificationChannels: Array.from(nextSet) });
      if (updatedUser) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      setSettings({
        push: nextSet.has('PUSH'),
        email: nextSet.has('EMAIL')
      });
    } catch (e) {
      console.error('Update notification channel failed', e);
    }
  };

  const sendBrowserNotification = (title: string, body?: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, { 
        body, 
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        requireInteraction: true,
        timestamp: Date.now(),
        data: { url: window.location.origin }
      });
    } catch (e) {
      // ignore
    }
  };

  return (
    <>
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border dark:border-slate-700 shadow-sm">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Bell className="w-5 h-5 text-blue-600" /> {t.notificationChannels}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={async () => {
              const next = new Set<'EMAIL' | 'PUSH'>([]);
              if (settings.email) next.add('EMAIL');
              if (settings.push) next.add('PUSH');

              if (settings.push) {
                next.delete('PUSH');
                await applyChannels(next);
                return;
              }

              const granted = await requestPushPermission();
              if (granted) {
                next.add('PUSH');
                await applyChannels(next);
                sendBrowserNotification(t.pushEnabledTitle, t.pushEnabledBody);
              } else {
                console.warn('Push notification permission denied');
                await applyChannels(next);
              }
            }} 
            className={`p-4 rounded-xl border transition-all text-left flex items-center gap-3 ${settings.push ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'}`}>
            <Smartphone className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-semibold text-sm">{t.browserPush}</div>
              <div className="text-xs text-slate-500">{t.browserPushDesc}</div>
            </div>
          </button>
          <button 
            onClick={async () => {
              const next = new Set<'EMAIL' | 'PUSH'>([]);
              if (settings.push) next.add('PUSH');
              if (settings.email) next.add('EMAIL');

              if (settings.email) {
                next.delete('EMAIL');
              } else {
                next.add('EMAIL');
              }

              await applyChannels(next);
            }} 
            className={`p-4 rounded-xl border transition-all text-left flex items-center gap-3 ${settings.email ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'}`}>
            <Mail className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="font-semibold text-sm">{t.emailDigest}</div>
              <div className="text-xs text-slate-500">{t.emailDigestDesc}</div>
            </div>
          </button>
        </div>

      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border dark:border-slate-700 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-base">{t.reminderList}</h3>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
              >
                <option value="all">{t.filterAll}</option>
                <option value="task">{t.filterTask}</option>
                <option value="event">{t.filterEvent}</option>
              </select>
              <span className="text-xs text-slate-500 whitespace-nowrap">{reminderCount} {t.items}</span>
            </div>
          </div>
          <div className="space-y-3 max-h-72 overflow-auto pr-1">
            {reminderCount > 0 ? (
              <>
                {reminderTasks.map(task => (
                  <div 
                    key={task.id} 
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    onClick={() => {
                      setEditingReminderId(task.id);
                      setEditingMinutes(task.reminderMinutesBefore ?? 5);
                      setEditingMode('auto');
                      setEditingReminderAt(
                        task.reminderAt
                          ? toInputValue(task.reminderAt)
                          : task.dueDate
                            ? format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm")
                            : nowIso
                      );
                    }}
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600"><Bell className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">{task.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t.remindBefore}: {task.reminderMinutesBefore || 0} {t.minutesShort} | {formatDateDisplay(task.dueDate)}
                      </div>
                    </div>
                    <button
                      onClick={() => onUpdateTask(task.id, { reminderEnabled: false, reminderMinutesBefore: undefined, reminderAt: undefined })}
                      className="text-xs font-semibold text-red-500 hover:text-red-600"
                    >
                      {t.removeReminder}
                    </button>
                  </div>
                ))}
                {showNotes && pendingNoteReminders.map(note => (
                  <div
                    key={note._id || note.id || note.targetId}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600"><Bell className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">{note.title || t.notes}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t.reminderTime}: {formatDateDisplay(note.sendAt || note.dueDate || '')}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">{t.notes}</span>
                  </div>
                ))}
              </>
            ) : <div className="text-center text-slate-400 font-medium py-6">{t.noReminders}</div>}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-500" />
              <h3 className="font-bold text-base">{t.sentReminders}</h3>
            </div>
            <span className="text-xs text-slate-500">{sentReminderCount} {t.items}</span>
          </div>
          <div className="space-y-3 max-h-72 overflow-auto pr-1">
            {sentReminderCount > 0 ? (
              <>
                {sentReminderTasks.map(task => (
                  <div key={task.id} className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center gap-3 bg-slate-50/40 dark:bg-slate-800/40">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><CheckCircle2 className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">{task.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t.remindBefore}: {task.reminderMinutesBefore || 0} {t.minutesShort} | {formatDateDisplay(task.dueDate)}
                      </div>
                    </div>
                    <button
                      onClick={() => onUpdateTask(task.id, { reminderSent: false })}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title={t.removeReminder}
                      aria-label={t.removeReminder}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {showNotes && sentNoteReminders.map(note => (
                  <div key={note._id || note.id || note.targetId} className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center gap-3 bg-slate-50/40 dark:bg-slate-800/40">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><CheckCircle2 className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">{note.title || t.notes}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t.reminderTime}: {formatDateDisplay(note.sendAt || note.dueDate || '')}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">{t.notes}</span>
                  </div>
                ))}
              </>
            ) : <div className="text-center text-slate-400 font-medium py-6">{t.noSentReminders}</div>}
          </div>
        </div>
      </div>
    </div>

    {editingReminderId && (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className={`w-full max-w-sm rounded-2xl shadow-2xl border ${darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <div className="px-5 py-4 border-b dark:border-slate-800 flex justify-between items-center">
            <h4 className="font-bold text-base">{t.editReminderTitle}</h4>
            <button onClick={() => setEditingReminderId(null)} className="text-slate-400 hover:text-slate-600">×</button>
          </div>
          <div className="p-5 space-y-3">
            <div className="text-sm text-slate-500">{t.editReminderSubtitle}</div>
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-1">
              <button
                type="button"
                onClick={() => {
                  setEditingMode('auto');
                  if (activeEditingTask?.dueDate) {
                    const reminderAt = new Date(new Date(activeEditingTask.dueDate).getTime() - editingMinutes * 60000);
                    if (!Number.isNaN(reminderAt.getTime()) && reminderAt.getTime() < Date.now()) {
                      showToast(t.reminderPastError, 'error');
                    }
                  }
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                  editingMode === 'auto'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.autoReminder}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingMode('manual');
                  if (!editingReminderAt) {
                    if (activeEditingTask?.dueDate) {
                      setEditingReminderAt(format(new Date(activeEditingTask.dueDate), "yyyy-MM-dd'T'HH:mm"));
                    } else {
                      setEditingReminderAt(nowIso);
                    }
                  }
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                  editingMode === 'manual'
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.manualReminder}
              </button>
            </div>
            {editingMode === 'manual' ? (
              <input
                type="datetime-local"
                value={editingReminderAt}
                min={nowIso}
                required
                onChange={(e) => {
                  if (isPast(e.target.value)) {
                    showToast(t.reminderPastError, 'error');
                    return;
                  }
                  setEditingReminderAt(e.target.value);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            ) : (
              <>
                <select
                  value={editingMinutes}
                  onChange={(e) => {
                    const nextMinutes = parseInt(e.target.value) || 0;
                    if (activeEditingTask?.dueDate) {
                      const reminderAt = new Date(new Date(activeEditingTask.dueDate).getTime() - nextMinutes * 60000);
                      if (!Number.isNaN(reminderAt.getTime()) && reminderAt.getTime() < Date.now()) {
                        showToast(t.reminderPastError, 'error');
                        return;
                      }
                    }
                    setEditingMinutes(nextMinutes);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {[0, 5, 15, 30, 60, 120, 240, 1440].map(min => (
                    <option key={min} value={min}>
                      {min === 0 ? (language === 'vi' ? 'Đúng giờ' : 'At due time') : `${min} ${t.minutesShort}`}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t.autoReminderHint.replace('{minutes}', String(editingMinutes)).replace('{unit}', t.minutesShort)}
                </p>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditingReminderId(null)} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">{t.cancel}</button>
              <button
                onClick={() => {
                  if (!activeEditingTask || !activeEditingTask.dueDate) { setEditingReminderId(null); return; }
                  let reminderAt: string | undefined;
                  let reminderMinutesBefore: number | undefined;
                  if (editingMode === 'manual') {
                    const manualDate = new Date(editingReminderAt);
                    if (!Number.isNaN(manualDate.getTime())) {
                      reminderAt = manualDate.toISOString();
                      const diffMin = Math.round((new Date(activeEditingTask.dueDate).getTime() - manualDate.getTime()) / 60000);
                      reminderMinutesBefore = diffMin > 0 ? diffMin : 0;
                    }
                  } else {
                    reminderMinutesBefore = editingMinutes;
                    const due = new Date(activeEditingTask.dueDate);
                    const sendAtDate = new Date(due.getTime() - (editingMinutes || 0) * 60000);
                    reminderAt = sendAtDate.toISOString();
                  }
                  if (reminderAt && new Date(reminderAt).getTime() < Date.now()) {
                    showToast(t.reminderPastError, 'error');
                    return;
                  }
                  if (reminderAt) {
                    onUpdateTask(activeEditingTask.id, { reminderEnabled: true, reminderMinutesBefore, reminderAt });
                  }
                  setEditingReminderId(null);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Reminders;
