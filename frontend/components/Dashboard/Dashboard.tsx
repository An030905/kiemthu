
import React from 'react';
import { User, TimetableEvent, Task, TaskStatus } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Calendar as CalendarIcon, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale/vi';
import { enUS } from 'date-fns/locale/en-US';
import { SHORT_DAYS_VI, SHORT_DAYS_EN } from '../../constants';

interface DashboardProps {
  user: User;
  events: TimetableEvent[];
  tasks: Task[];
  onNavigate: (id: string) => void;
  language: 'en' | 'vi';
  t: any;
}

const Dashboard: React.FC<DashboardProps> = ({ user, events, tasks, onNavigate, language, t }) => {
  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const pendingTasks = tasks.length - completedTasks;
  const todayEvents = events.filter(e => e.dayOfWeek === new Date().getDay());
  const currentLocale = language === 'vi' ? vi : enUS;
  const shortDays = language === 'vi' ? SHORT_DAYS_VI : SHORT_DAYS_EN;

  const taskData = [
    { name: t.completed, value: completedTasks, color: '#10b981' },
    { name: t.todo, value: pendingTasks, color: '#f59e0b' },
  ];

  // Logic: Calculate actual study hours per day from events
  const hoursPerDay = Array(7).fill(0);
  events.forEach(event => {
    const [startH, startM] = event.startTime.split(':').map(Number);
    const [endH, endM] = event.endTime.split(':').map(Number);
    const duration = (endH + endM / 60) - (startH + startM / 60);
    if (duration > 0) {
      hoursPerDay[event.dayOfWeek] += duration;
    }
  });

  const studyHoursData = [
    { day: shortDays[1], hours: parseFloat(hoursPerDay[1].toFixed(1)) },
    { day: shortDays[2], hours: parseFloat(hoursPerDay[2].toFixed(1)) },
    { day: shortDays[3], hours: parseFloat(hoursPerDay[3].toFixed(1)) },
    { day: shortDays[4], hours: parseFloat(hoursPerDay[4].toFixed(1)) },
    { day: shortDays[5], hours: parseFloat(hoursPerDay[5].toFixed(1)) },
    { day: shortDays[6], hours: parseFloat(hoursPerDay[6].toFixed(1)) },
    { day: shortDays[0], hours: parseFloat(hoursPerDay[0].toFixed(1)) },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: t.classesToday, value: todayEvents.length, icon: <CalendarIcon className="w-6 h-6" />, color: 'bg-blue-500' },
          { label: t.activeTasks, value: pendingTasks, icon: <AlertCircle className="w-6 h-6" />, color: 'bg-amber-500' },
          { label: t.completedTasks, value: completedTasks, icon: <CheckCircle className="w-6 h-6" />, color: 'bg-emerald-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-xl text-white`}>{stat.icon}</div>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.studyEfficiency}</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studyHoursData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                  formatter={(value) => [`${value} ${t.hour}`, t.studyHours]}
                />
                <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-8">{t.taskDistribution}</h2>
          <div className="h-64 flex flex-col items-center">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={taskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {taskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-4">
              {taskData.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: entry.color}}></div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.upcomingClasses}</h2>
            <button onClick={() => onNavigate('timetable')} className="text-sm text-blue-600 font-semibold hover:underline">{t.viewAll}</button>
          </div>
          <div className="space-y-4">
            {todayEvents.length > 0 ? todayEvents.sort((a,b) => a.startTime.localeCompare(b.startTime)).map((event) => (
              <div key={event.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <div className="w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold text-white shadow-sm flex-shrink-0" style={{backgroundColor: event.color}}>
                  <span className="text-[9px] opacity-80 uppercase leading-none font-black">{shortDays[event.dayOfWeek]}</span>
                  <span className="text-lg leading-none mt-0.5">{event.startTime.split(':')[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{event.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {event.startTime} - {event.endTime} | {event.room}
                  </p>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-slate-400 font-medium">{t.noClassesToday}</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.pendingAssignments}</h2>
            <button onClick={() => onNavigate('tasks')} className="text-sm text-blue-600 font-semibold hover:underline">{t.manageTasks}</button>
          </div>
          <div className="space-y-4">
            {tasks.filter(t => t.status !== TaskStatus.COMPLETED).slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                <div className={`w-2 h-10 rounded-full flex-shrink-0 ${
                  task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`}></div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{task.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {t.due}: {format(new Date(task.dueDate), 'd MMM, p', { locale: currentLocale })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
