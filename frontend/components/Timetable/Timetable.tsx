
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TimetableEvent, EventType, Note } from '../../types';
import { Plus, ChevronLeft, ChevronRight, Trash2, MapPin, Clock, X, Check, Target, Link as LinkIcon, User as UserIcon, Download, FileSpreadsheet, FileText, ImageIcon, Loader2 } from 'lucide-react';
import { DAYS_EN, DAYS_VI, SHORT_DAYS_EN, SHORT_DAYS_VI, COLORS, PERIOD_TIME_MAP } from '../../constants';
import { format, addDays, isSameDay, getDay } from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { GoogleGenAI, Type } from "@google/genai";

interface TimetableProps {
  events: TimetableEvent[];
  notes: Note[];
  onSaveNote: (note: Note) => void;
  onAddEvent: (event: TimetableEvent) => Promise<any> | void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent: (id: string, updates: Partial<TimetableEvent>) => Promise<any> | void;
  darkMode: boolean;
  language: 'en' | 'vi';
  t: any;
}

const Timetable: React.FC<TimetableProps> = ({ events, notes, onSaveNote, onAddEvent, onDeleteEvent, onUpdateEvent, darkMode, language, t }) => {
  const [view, setView] = useState<'day' | 'week'>('week');
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimetableEvent | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputImageRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [selectedType, setSelectedType] = useState<EventType>(EventType.REGULAR);
  const [formDate, setFormDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [computedDay, setComputedDay] = useState<number>(getDay(new Date()));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [noteContent, setNoteContent] = useState('');
  const [noteReminderEnabled, setNoteReminderEnabled] = useState(false);
  const [noteReminderAt, setNoteReminderAt] = useState('');
  const localNow = new Date();
  localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset());
  const nowIso = localNow.toISOString().slice(0,16);

  useEffect(() => {
    if (formDate) {
      const parsed = new Date(formDate);
      if (!isNaN(parsed.getTime())) {
        setComputedDay(getDay(parsed));
      }
    }
  }, [formDate]);

  const shortDaysLabels = language === 'en' ? SHORT_DAYS_EN : SHORT_DAYS_VI;

  const currentLocale = language === 'vi' ? vi : enUS;

  const weekDays = useMemo(() => {
    const day = currentDate.getDay();
    const diff = (day + 6) % 7; 
    const start = addDays(currentDate, -diff);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const displayDays = useMemo(() => (view === 'week' ? weekDays : [currentDate]), [view, weekDays, currentDate]);

  const eventDayOfWeek = (ev: TimetableEvent) => {
    if (ev.startDate) {
      const d = new Date(ev.startDate);
      if (!isNaN(d.getTime())) return d.getDay();
    }
    return ev.dayOfWeek;
  };

  const dateDiffDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    return Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const displayDateForEvent = (ev: TimetableEvent, weekDays: Date[]) => {
    if (ev.startDate) {
      const d = new Date(ev.startDate);
      if (!isNaN(d.getTime())) return d;
    }
    if ((ev as any).createdAt) {
      const d = new Date((ev as any).createdAt);
      if (!isNaN(d.getTime())) return d;
    }
    const target = weekDays.find(d => d.getDay() === ev.dayOfWeek);
    return target || weekDays[0];
  };

  const buildUpdatePayload = (event: TimetableEvent, overrides: Partial<TimetableEvent>) => ({
    title: event.title,
    code: event.code,
    instructor: event.instructor,
    room: event.room,
    link: event.link,
    type: event.type,
    dayOfWeek: event.dayOfWeek,
    startTime: event.startTime,
    endTime: event.endTime,
    startDate: event.startDate,
    color: event.color,
    notes: event.notes,
    reminderMinutes: event.reminderMinutes,
    ...overrides
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success', duration = 3000) => {
    setToast({ message, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), duration);
  };

  const isPast = (dateValue: string) => {
    const date = new Date(dateValue);
    return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
  };

  const toInputValue = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return nowIso;
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showImportModal) return;
    dropzoneRef.current?.focus();
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            setShowImportModal(false);
            processImportFile(file);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [showImportModal]);

  const processImportFile = async (file: File) => {
    setIsAnalyzing(true);
    if (!process.env.API_KEY) {
      showToast(
        language === 'en'
          ? 'Missing Gemini API key. Set GEMINI_API_KEY in frontend/.env.local and restart.'
          : 'Thiếu Gemini API key. Đặt GEMINI_API_KEY trong frontend/.env.local và khởi động lại.',
        'error'
      );
      setIsAnalyzing(false);
      if (fileInputImageRef.current) fileInputImageRef.current.value = '';
      return;
    }
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const systemPrompt = `
        You are an academic assistant. Analyze the timetable image and extract data.
        Table structure:
        - Columns: Monday to Sunday.
        - Rows: Morning, Afternoon, Evening.
        - Each cell contains: code, subject name, type (LT/TH), period range, room.

        Output a JSON array with items:
        {
          "title": string,
          "code": string,
          "instructor": string (or "Unknown"),
          "room": string,
          "dayOfWeek": number (0 Sunday ... 6 Saturday),
          "startPeriod": number (1-14),
          "endPeriod": number (1-14),
          "type": "REGULAR" | "EXAM"
        }

        Notes:
        - If period is "1-3" => startPeriod=1, endPeriod=3.
        - Output JSON only, no extra text.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { inlineData: { mimeType: file.type, data: base64Data } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                code: { type: Type.STRING },
                instructor: { type: Type.STRING },
                room: { type: Type.STRING },
                dayOfWeek: { type: Type.INTEGER },
                startPeriod: { type: Type.INTEGER },
                endPeriod: { type: Type.INTEGER },
                type: { type: Type.STRING }
              },
              required: ["title", "dayOfWeek", "startPeriod", "endPeriod"]
            }
          }
        }
      });

      const extractedData = JSON.parse(response.text);
      let added = 0;

      extractedData.forEach((item: any, index: number) => {
        const startTimeStr = PERIOD_TIME_MAP[item.startPeriod]?.start || "07:00";
        const endTimeStr = PERIOD_TIME_MAP[item.endPeriod]?.end || "11:35";
        const targetDate = weekDays.find(d => d.getDay() === item.dayOfWeek) || weekDays[0];
        const startDateStr = format(targetDate, 'yyyy-MM-dd');

        const newEvent: TimetableEvent = {
          id: `ai-${Date.now()}-${index}` as string,
          title: item.title,
          code: item.code,
          instructor: item.instructor || "Unknown",
          room: item.room || "TBA",
          type: (item.type as EventType) || EventType.REGULAR,
          dayOfWeek: item.dayOfWeek,
          startTime: startTimeStr,
          endTime: endTimeStr,
          startDate: startDateStr,
          color: COLORS[index % COLORS.length]
        };
        if (checkConflict(newEvent)) {
          return;
        }
        onAddEvent(newEvent);
        added += 1;
      });

      if (added > 0) {
        showToast(t.importSuccess, 'success');
      } else {
        showToast(language === 'en' ? 'All imported slots conflict with existing ones' : 'Tất cả lịch import bị trùng, không thêm được', 'error');
      }

    } catch (err) {
      console.error("AI Analysis Error:", err);
      showToast(t.importError, 'error');
    } finally {
      setIsAnalyzing(false);
      if (fileInputImageRef.current) fileInputImageRef.current.value = '';
    }
  };

  const checkConflict = (newEvent: Omit<TimetableEvent, 'id'>, ignoreId?: string) => {
    return events.some(event => {
      const eventId = event.id || (event as any)._id;
      if (eventId === ignoreId) return false;
      const evHasDate = Boolean(event.startDate);
      const newHasDate = Boolean(newEvent.startDate);
      // Nếu event cũ không có startDate nhưng event mới có startDate, bỏ qua để tránh đụng dữ liệu cũ
      if (!evHasDate && newHasDate) return false;
      if (evHasDate && newHasDate && event.startDate !== newEvent.startDate) return false;
      const evDay = eventDayOfWeek(event);
      const newDay = newEvent.startDate ? new Date(newEvent.startDate).getDay() : newEvent.dayOfWeek;
      if (evDay !== newDay) return false;
      const newStart = toMinutes(newEvent.startTime);
      const newEnd = toMinutes(newEvent.endTime);
      const existingStart = toMinutes(event.startTime);
      const existingEnd = toMinutes(event.endTime);
      if ([newStart, newEnd, existingStart, existingEnd].some(v => Number.isNaN(v))) return false;
      return newStart < existingEnd && newEnd > existingStart;
    });
  };

  const handleExportExcel = () => {
    const headers = ["Title", "Code", "Instructor", "Room/Link", "Type", "Day", "StartTime", "EndTime"];
    const csvContent = [
      headers.join(","),
      ...events.map(e => [
        `"${e.title}"`,
        `"${e.code}"`,
        `"${e.instructor}"`,
        `"${e.type === EventType.ONLINE ? e.link : e.room}"`,
        e.type,
        e.dayOfWeek,
        e.startTime,
        e.endTime
      ].join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `timetable_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>UniFlow Timetable - ${format(new Date(), 'PPP')}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #334155; }
            h1 { text-align: center; color: #2563eb; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 14px; }
            th { background-color: #f8fafc; font-weight: bold; text-transform: uppercase; color: #64748b; font-size: 12px; }
            .type { font-weight: 900; font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #eee; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h1>${t.timetable.toUpperCase()} - ${language === 'en' ? 'UniFlow' : 'Hệ Thống UniFlow'}</h1>
          <table>
            <thead>
              <tr>
                <th>${t.day}</th>
                <th>${t.startTime}</th>
                <th>${t.endTime}</th>
                <th>${t.subjectTitle}</th>
                <th>${t.instructor}</th>
                <th>${t.room}</th>
                <th>${t.type}</th>
              </tr>
            </thead>
            <tbody>
              ${events.sort((a,b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map(e => `
                <tr>
                  <td>${shortDaysLabels[e.dayOfWeek]}</td>
                  <td>${e.startTime}</td>
                  <td>${e.endTime}</td>
                  <td><strong>${e.title}</strong><br/><small>${e.code || ''}</small></td>
                  <td>${e.instructor}</td>
                  <td>${e.type === EventType.ONLINE ? e.link : e.room}</td>
                  <td><span class="type">${t.typeLabels[e.type]}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleImportImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowImportModal(false);
    await processImportFile(file);
  };

  const handleOpenAdd = () => {
    setEditingEvent(null);
    setSelectedType(EventType.REGULAR);
    setFormDate(format(currentDate, 'yyyy-MM-dd'));
    setStartTime('08:00');
    setEndTime('10:00');
    setSelectedColor(COLORS[0]);
    setNoteContent('');
    setNoteReminderEnabled(false);
    setNoteReminderAt(nowIso);
    setShowModal(true);
  };

  const handleOpenEdit = (event: TimetableEvent) => {
    const eventId = event.id || (event as any)._id;
    const existingNote = notes.find(note => note.eventId === eventId);
    setEditingEvent(event);
    setSelectedType(event.type);
    setFormDate(event.startDate || format(new Date(), 'yyyy-MM-dd'));
    setStartTime(event.startTime);
    setEndTime(event.endTime);
    setSelectedColor(event.color);
    setNoteContent(existingNote?.content || '');
    setNoteReminderEnabled(!!existingNote?.reminderEnabled);
    setNoteReminderAt(existingNote?.reminderAt ? toInputValue(existingNote.reminderAt) : nowIso);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const locationValue = formData.get('location') as string;
    let noteReminderAtValue: string | undefined;
    if (noteReminderEnabled) {
      if (isPast(noteReminderAt)) {
        showToast(t.reminderPastError, 'error');
        return;
      }
      const reminderDate = new Date(noteReminderAt);
      if (Number.isNaN(reminderDate.getTime())) {
        showToast(t.reminderPastError, 'error');
        return;
      }
      noteReminderAtValue = reminderDate.toISOString();
    }

    const eventData: Omit<TimetableEvent, 'id'> = {
      title: formData.get('title') as string,
      code: formData.get('code') as string || '',
      instructor: formData.get('instructor') as string,
      room: selectedType !== EventType.ONLINE ? locationValue : 'Online',
      link: selectedType === EventType.ONLINE ? locationValue : '',
      type: selectedType,
      dayOfWeek: computedDay,
      startTime: startTime,
      endTime: endTime,
      startDate: formDate,
      color: selectedColor,
      notes: noteContent,
      reminderMinutes: parseInt(formData.get('reminderMinutes') as string) || 0,
    };

    const editingId = editingEvent?.id || (editingEvent as any)?._id;
    if (checkConflict(eventData, editingId)) {
      showToast(
        language === 'en'
          ? "Schedule conflict! This time slot is already taken."
          : "Trùng lịch! Khung giờ này đã có tiết khác.",
        'error'
      );
      return;
    }

    try {
      if (editingEvent) {
        await onUpdateEvent(editingId || '', eventData);
        if (noteContent.trim() || noteReminderEnabled) {
          onSaveNote({
            id: Date.now().toString(),
            eventId: editingId || '',
            content: noteContent,
            updatedAt: new Date().toISOString(),
            reminderEnabled: noteReminderEnabled,
            reminderAt: noteReminderEnabled ? noteReminderAtValue : undefined
          });
        }
        showToast(language === 'en' ? 'Updated successfully' : 'Cập nhật thành công', 'success');
      } else {
        const created = await onAddEvent({ ...eventData, id: Date.now().toString() });
        const createdId = created?.id || created?._id;
        if (createdId && (noteContent.trim() || noteReminderEnabled)) {
          onSaveNote({
            id: Date.now().toString(),
            eventId: createdId,
            content: noteContent,
            updatedAt: new Date().toISOString(),
            reminderEnabled: noteReminderEnabled,
            reminderAt: noteReminderEnabled ? noteReminderAtValue : undefined
          });
        }
        showToast(language === 'en' ? 'Created successfully' : 'Tạo lịch thành công', 'success');
      }
      setShowModal(false);
    } catch (err: any) {
      const msg = err?.message || (language === 'en' ? 'Cannot create event' : 'Không tạo được lịch');
      showToast(msg, 'error');
    }
  };

  const [slotMinutes, setSlotMinutes] = useState<number>(60);
  const dayStartMinutes = 7 * 60;
  const dayEndMinutes = 21 * 60;
  const slots: number[] = [];
  for (let m = dayStartMinutes; m < dayEndMinutes; m += slotMinutes) {
    slots.push(m);
  }
  const slotHeight = 80 * (slotMinutes / 60); // 80px per hour baseline
  const minEventHeight = 32;

  const formatSlotLabel = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col space-y-6">
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
      <input type="file" ref={fileInputImageRef} onChange={handleImportImage} accept="image/*" className="hidden" />
      
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-1">
            {['day', 'week'].map((v) => (
              <button key={v} onClick={() => setView(v as any)} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}>{t[v]}</button>
            ))}
          </div>
          <button onClick={() => setCurrentDate(new Date())} className="p-2 rounded-lg border dark:border-slate-700 hover:bg-slate-50 transition-colors bg-white dark:bg-slate-800 shadow-sm"><Target className="w-5 h-5 text-slate-500" /></button>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentDate(addDays(currentDate, view === 'week' ? -7 : -1))} className="p-2 hover:bg-slate-100 rounded-full dark:hover:bg-slate-800 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
            <span className="font-bold text-slate-700 dark:text-slate-200 min-w-[160px] text-center">
              {view === 'week' 
                ? `${format(weekDays[0], language === 'vi' ? 'd MMM' : 'MMM d', { locale: currentLocale })} - ${format(weekDays[6], language === 'vi' ? 'd MMM' : 'MMM d', { locale: currentLocale })}`
                : format(currentDate, language === 'vi' ? "dd MMMM, yyyy" : 'MMMM d, yyyy', { locale: currentLocale })
              }
            </span>
            <button onClick={() => setCurrentDate(addDays(currentDate, view === 'week' ? 7 : 1))} className="p-2 hover:bg-slate-100 rounded-full dark:hover:bg-slate-800 transition-colors"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
           <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-1">
              <button 
                onClick={() => setShowImportModal(true)} 
                disabled={isAnalyzing}
                className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-slate-600 dark:text-slate-300 group disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> : <ImageIcon className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform" />}
                <span className="text-xs font-bold hidden sm:inline">{isAnalyzing ? t.analyzingImage : t.importImage}</span>
              </button>
              <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
              <button onClick={handleExportExcel} className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-slate-600 dark:text-slate-300 group" title={t.exportExcel}>
                <FileSpreadsheet className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold hidden sm:inline">Excel</span>
              </button>
              <button onClick={handleExportPDF} className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-slate-600 dark:text-slate-300 group" title={t.exportPDF}>
                <FileText className="w-5 h-5 text-red-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold hidden sm:inline">PDF</span>
              </button>
           </div>
           <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 px-2 py-1 gap-1 text-xs font-semibold text-slate-600 dark:text-slate-200">
             <span className="hidden sm:inline">{language === 'en' ? 'Grid' : 'Lưới'}</span>
             {[60,30,15].map(val => (
               <button
                 key={val}
                 onClick={() => setSlotMinutes(val)}
                 className={`px-2 py-1 rounded-md ${slotMinutes === val ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
               >
                 {val}'
               </button>
             ))}
           </div>
           <button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all font-bold"><Plus className="w-5 h-5" /><span>{t.addClass}</span></button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-auto no-scrollbar relative">
        {isAnalyzing && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] z-[40] flex flex-col items-center justify-center gap-4">
             <div className="relative">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                <ImageIcon className="w-6 h-6 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
             </div>
             <p className="font-bold text-slate-700 dark:text-slate-200 animate-pulse">{t.analyzingImage}</p>
          </div>
        )}
        
        <div className={`${view === 'week' ? 'min-w-[800px]' : 'max-w-4xl mx-auto'} relative pb-10`}>
          <div className={`grid grid-cols-[80px_repeat(${view === 'week' ? 7 : 1},1fr)] border-b dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-30`}>
            <div className="p-4"></div>
            {displayDays.map((day, i) => (
              <div key={i} className={`p-4 text-center border-l dark:border-slate-700 ${isSameDay(day, new Date()) ? 'bg-blue-50/30' : ''}`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{shortDaysLabels[day.getDay()]}</p>
                <p className={`text-lg font-black ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-slate-700 dark:text-slate-200'}`}>{format(day, 'd')}</p>
              </div>
            ))}
          </div>
          <div className="relative">
            {slots.map((slot) => (
              <div key={slot} className={`grid grid-cols-[80px_repeat(${view === 'week' ? 7 : 1},1fr)] border-b dark:border-slate-700`} style={{ minHeight: `${slotHeight}px` }}>
                <div className="pl-4 pr-2 py-2 text-[11px] font-bold text-slate-400 text-right select-none opacity-60">
                  {formatSlotLabel(slot)}
                </div>
                {displayDays.map((day, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="border-l dark:border-slate-700 hover:bg-slate-50/50 transition-colors"
                    style={{ minHeight: `${slotHeight}px` }}
                  />
                ))}
              </div>
            ))}
            {events.filter(event => {
              const eventDate = displayDateForEvent(event, weekDays);
              const weekStart = new Date(weekDays[0]);
              weekStart.setHours(0,0,0,0);
              const weekEnd = new Date(weekDays[6]);
              weekEnd.setHours(23,59,59,999);
              return eventDate >= weekStart && eventDate <= weekEnd;
            }).map((event) => {
              const displayDays = view === 'week' ? weekDays : [currentDate];
              const dayIdxInGrid = displayDays.findIndex(d => d.getDay() === eventDayOfWeek(event));
              if (dayIdxInGrid === -1) return null;
              const startH = parseInt(event.startTime.split(':')[0]);
              const startM = parseInt(event.startTime.split(':')[1]);
              const endH = parseInt(event.endTime.split(':')[0]);
              const endM = parseInt(event.endTime.split(':')[1]);
              const startTotal = startH * 60 + startM;
              const duration = (endH * 60 + endM) - startTotal;
              const top = ((startTotal - dayStartMinutes) / slotMinutes) * slotHeight;
              const height = Math.max(minEventHeight, (duration / slotMinutes) * slotHeight);
              
              const isVirtual = event.type === EventType.ONLINE;
              const locationText = isVirtual ? event.link : event.room;

              return (
                <div
                  key={event.id}
                  onClick={() => handleOpenEdit(event)}
                  className="absolute rounded-xl p-4 text-white shadow-xl z-10 overflow-hidden cursor-pointer active:opacity-50 transition-all hover:scale-[1.01] border border-white/20 flex flex-col"
                  style={{ left: `calc(80px + ${dayIdxInGrid} * (100% - 80px) / ${displayDays.length} + 4px)`, width: `calc((100% - 80px) / ${displayDays.length} - 8px)`, top: `${top + 4}px`, height: `${height - 8}px`, backgroundColor: event.color }}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="flex gap-1.5">
                      <span className="font-black bg-white/25 px-2 py-0.5 rounded text-[10px] uppercase tracking-tighter shrink-0">{t.typeLabels[event.type]}</span>
                      <span className="font-black bg-black/10 px-2 py-0.5 rounded text-[10px] uppercase tracking-tighter shrink-0">{shortDaysLabels[event.dayOfWeek]}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }} className="hover:bg-black/10 rounded p-1 transition-colors -mt-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  
                  <div className="font-black text-lg leading-tight mb-2 line-clamp-2">
                    <span className="opacity-75 font-bold mr-1.5">{t.labels.subject}</span>{event.title}
                  </div>
                  
                  <div className="mt-auto space-y-1.5">
                    <div className="flex items-center gap-2 opacity-95 text-[12px] font-bold truncate">
                      <Clock className="w-3.5 h-3.5 shrink-0" /> {event.startTime} - {event.endTime}
                    </div>
                    <div className="flex items-center gap-2 opacity-95 text-[12px] font-bold truncate">
                      <UserIcon className="w-3.5 h-3.5 shrink-0" /> <span className="opacity-75">{t.labels.instructor}</span> {event.instructor}
                    </div>
                    <div className="flex items-center gap-2 opacity-95 text-[12px] font-bold truncate">
                      {isVirtual ? <LinkIcon className="w-3.5 h-3.5 shrink-0" /> : <MapPin className="w-3.5 h-3.5 shrink-0" />}
                      <span className="opacity-75">{isVirtual ? 'Link:' : t.labels.room}</span> {locationText}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden ${darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            <div className="px-6 py-4 flex items-center justify-between border-b dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black">{t.importImageTitle}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.importImageSubtitle}</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div
                ref={dropzoneRef}
                tabIndex={0}
                onClick={() => fileInputImageRef.current?.click()}
                onDragEnter={(e) => { e.preventDefault(); setIsDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    setShowImportModal(false);
                    processImportFile(file);
                  }
                }}
                className={`group w-full rounded-3xl border-2 border-dashed p-10 text-center transition-all outline-none ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 hover:border-blue-400'
                }`}
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/20">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <p className="text-base font-bold">{t.importImageTitle}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.importImageSubtitle}</p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-500">
                  <span className="rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5">Ctrl + V</span>
                  <span className="rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5">{t.importImage}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 ${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}`}>
            <div className="px-6 py-4 flex justify-between items-center border-b dark:border-slate-700">
              <h3 className="text-lg font-bold uppercase tracking-tight">{editingEvent ? t.editClass : t.addClass}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.subjectTitle}</label>
                  <input required name="title" defaultValue={editingEvent?.title} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.code}</label>
                  <input name="code" defaultValue={editingEvent?.code} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 outline-none font-bold text-lg" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.type}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: EventType.REGULAR, label: t.regular },
                    { val: EventType.ONLINE, label: t.online },
                    { val: EventType.EXAM, label: t.exam },
                  ].map((type) => (
                    <button
                      key={type.val}
                      type="button"
                      onClick={() => setSelectedType(type.val)}
                      className={`py-2.5 rounded-xl text-xs font-black transition-all border-2 ${
                        selectedType === type.val 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                        : 'bg-transparent border-slate-200 dark:border-slate-600 text-slate-500 hover:border-blue-300'
                      }`}
                    >
                      {type.label.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.instructor}</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input required name="instructor" defaultValue={editingEvent?.instructor} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 pl-11 outline-none font-bold" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                    {selectedType === EventType.ONLINE ? t.link : t.room}
                  </label>
                  <div className="relative">
                    {selectedType === EventType.ONLINE ? (
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                    ) : (
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    )}
                    <input 
                      required 
                      name="location" 
                      defaultValue={selectedType === EventType.ONLINE ? editingEvent?.link : editingEvent?.room} 
                      className={`w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 pl-11 outline-none font-bold ${selectedType === EventType.ONLINE ? 'text-blue-600' : ''}`} 
                      placeholder={selectedType === EventType.ONLINE ? "https://..." : "Phòng học / Nơi diễn ra"} 
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.day}</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 outline-none font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                   <div>
                     <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.startTime}</label>
                     <input required type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 outline-none font-bold" />
                   </div>
                   <div>
                     <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.endTime}</label>
                     <input required type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 outline-none font-bold" />
                   </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2.5">Tag Màu</label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map((color) => (
                    <button key={color} type="button" onClick={() => setSelectedColor(color)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${selectedColor === color ? 'ring-4 ring-offset-2 ring-blue-500/30 scale-110 shadow-lg shadow-black/10' : 'hover:scale-105'}`} style={{ backgroundColor: color }}>
                      {selectedColor === color && <Check className="w-6 h-6 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.eventNotes}</label>
                  <textarea
                    value={noteContent}
                    onChange={(event) => setNoteContent(event.target.value)}
                    rows={4}
                    placeholder={t.clickToWrite}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 outline-none font-semibold text-sm resize-none"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">{t.reminderToggle}</span>
                    <label className="inline-flex items-center cursor-pointer gap-2">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={noteReminderEnabled}
                        onChange={(event) => {
                          const nextEnabled = event.target.checked;
                          if (!nextEnabled) {
                            setNoteReminderEnabled(false);
                            return;
                          }
                          setNoteReminderEnabled(true);
                          if (!noteReminderAt) {
                            setNoteReminderAt(nowIso);
                          }
                        }}
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors ${noteReminderEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-0.5 ${noteReminderEnabled ? 'translate-x-5' : 'translate-x-1'}`}></div>
                      </div>
                    </label>
                  </div>
                  {noteReminderEnabled && (
                    <div className="mt-3">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">{t.reminderTime}</label>
                      <input
                        type="datetime-local"
                        value={noteReminderAt}
                        min={nowIso}
                        onChange={(event) => {
                          if (isPast(event.target.value)) {
                            showToast(t.reminderPastError, 'error');
                            return;
                          }
                          setNoteReminderAt(event.target.value);
                        }}
                        className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 outline-none font-semibold text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t dark:border-slate-700">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3.5 rounded-2xl font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all uppercase tracking-widest text-xs">{t.cancel}</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all uppercase tracking-widest text-xs">{editingEvent ? t.saveChanges : t.createEvent}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timetable;
