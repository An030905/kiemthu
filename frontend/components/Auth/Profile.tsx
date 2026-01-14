
import React, { useState } from 'react';
import { User } from '../../types';
import { GraduationCap, Shield, User as UserIcon, Edit2, Check, X, Mail, Image as ImageIcon } from 'lucide-react';
import { PREDEFINED_AVATARS } from '../../constants';

interface ProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
  darkMode: boolean;
  t: any;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdateUser, darkMode, t }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<User>(user);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSelectAvatar = (url: string) => {
    setFormData({ ...formData, avatar: url });
  };

  const handleSave = () => {
    onUpdateUser(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData(user);
    setIsEditing(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Profile Header */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden rounded-xl shadow-sm">
        <div className="h-40 bg-slate-800 dark:bg-slate-900 relative">
          <div className="absolute -bottom-16 left-8 flex flex-col sm:flex-row items-center sm:items-end gap-6 z-10">
            <div className="relative group">
              <div className="w-32 h-32 rounded-lg border-4 border-white dark:border-slate-800 bg-white overflow-hidden shadow-sm">
                <img src={formData.avatar || PREDEFINED_AVATARS[0]} className="w-full h-full object-cover" alt="Profile" />
              </div>
            </div>
            <div className="pb-2 text-center sm:text-left">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-none">{user.fullName}</h2>
              <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-1">{user.major}</p>
            </div>
          </div>
          <div className="absolute top-4 right-8 flex gap-2">
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-lg font-bold border border-white/20 transition-all flex items-center gap-2 backdrop-blur-sm">
                <Edit2 className="w-4 h-4" /> {t.edit_profile_btn}
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleCancel} className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-lg font-bold border border-white/20 backdrop-blur-md flex items-center gap-2">
                  <X className="w-4 h-4" /> {t.cancel}
                </button>
                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2">
                  <Check className="w-4 h-4" /> {t.saveChanges}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="pt-20 pb-8 px-8"></div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal Info & Avatar Picker */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white dark:bg-slate-800 p-8 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-8">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b dark:border-slate-700 pb-4">
              <UserIcon className="w-5 h-5 text-blue-600" /> {t.personal_info}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.full_name}</label>
                <input 
                  name="fullName" 
                  value={formData.fullName} 
                  onChange={handleChange} 
                  readOnly={!isEditing} 
                  className={`w-full bg-slate-50 dark:bg-slate-700 p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg transition-all ${
                    isEditing ? 'border-blue-500' : 'border-transparent'
                  }`}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.major}</label>
                <input 
                  name="major" 
                  value={formData.major} 
                  onChange={handleChange} 
                  readOnly={!isEditing} 
                  className={`w-full bg-slate-50 dark:bg-slate-700 p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none font-bold text-lg transition-all ${
                    isEditing ? 'border-blue-500' : 'border-transparent'
                  }`}
                />
              </div>
            </div>

            {isEditing && (
              <div className="space-y-4 pt-4 border-t dark:border-slate-700">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <ImageIcon className="w-3 h-3" /> {t.selectAvatar}
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {PREDEFINED_AVATARS.map((url, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleSelectAvatar(url)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${
                        formData.avatar === url ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-100 dark:border-slate-600'
                      }`}
                    >
                      <img src={url} className="w-full h-full object-cover" alt={`Avatar ${idx}`} />
                      {formData.avatar === url && (
                        <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                          <Check className="w-6 h-6 text-blue-600" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Security & Contact */}
        <div className="space-y-6">
          <section className="bg-white dark:bg-slate-800 p-6 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b dark:border-slate-700 pb-4">
              <Shield className="w-5 h-5 text-blue-600" /> {t.security}
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.email_address}</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300">{user.email}</p>
                </div>
                <Mail className="w-5 h-5 text-slate-300" />
              </div>
              <button className="w-full p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-left hover:border-blue-500 hover:text-blue-600 transition-all font-bold text-slate-500">
                {t.changePassword}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Profile;
