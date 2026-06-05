import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [deletePw, setDeletePw] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/users/me', { name, email });
      await refreshUser();
      toast.success('הפרופיל עודכן בהצלחה!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'עדכון הפרופיל נכשל');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error('הסיסמאות אינן תואמות'); return; }
    if (newPw.length < 6) { toast.error('הסיסמה חייבת להכיל לפחות 6 תווים'); return; }
    setChangingPw(true);
    try {
      await api.patch('/users/me', { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      toast.success('הסיסמה שונתה בהצלחה!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'שינוי הסיסמה נכשל');
    } finally {
      setChangingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePw) { toast.error('הזן סיסמה לאישור'); return; }
    setDeleting(true);
    try {
      await api.delete('/users/me', { data: { password: deletePw } });
      toast.success('החשבון נמחק');
      logout();
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'מחיקת החשבון נכשלה');
    } finally {
      setDeleting(false);
    }
  };

  const inputClass = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800";

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa', color: '#202124', direction: 'rtl' }}>
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ transform: 'scaleX(-1)' }}>
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          </div>
          <span className="font-semibold text-gray-800">הגדרות חשבון</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">פרטים אישיים</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">שם תצוגה</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">דואר אלקטרוני</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} dir="ltr" />
            </div>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'שומר...' : 'שמור שינויים'}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">שינוי סיסמה</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">סיסמה נוכחית</label>
              <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required
                className={inputClass} placeholder="הכנס סיסמה נוכחית" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">סיסמה חדשה</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required
                className={inputClass} placeholder="לפחות 6 תווים" dir="ltr" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">אישור סיסמה חדשה</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required
                className={inputClass} placeholder="חזור על הסיסמה החדשה" dir="ltr" />
            </div>
            <button type="submit" disabled={changingPw || !currentPw || !newPw || !confirmPw}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {changingPw ? 'משנה...' : 'שנה סיסמה'}
            </button>
          </form>
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-red-100">
          <h2 className="text-lg font-semibold text-red-600 mb-2">אזור מסוכן</h2>
          <p className="text-sm text-gray-500 mb-4">
            מחיקת החשבון תסיר לצמיתות את כל הנתונים שלך, כולל כל קישורי הפגישות הקבועות שלך.
            לא ניתן לבטל פעולה זו.
          </p>
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="px-5 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium text-sm">
              מחק את החשבון שלי
            </button>
          ) : (
            <div className="border border-red-200 rounded-xl p-4 bg-red-50">
              <p className="text-sm font-medium text-red-700 mb-3">האם אתה בטוח? הכנס סיסמה לאישור.</p>
              <input type="password" value={deletePw} onChange={e => setDeletePw(e.target.value)}
                placeholder="הסיסמה שלך"
                className="w-full px-4 py-2.5 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-3 bg-white" dir="ltr" />
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteConfirm(false); setDeletePw(''); }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
                  ביטול
                </button>
                <button onClick={handleDeleteAccount} disabled={deleting || !deletePw}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50">
                  {deleting ? 'מוחק...' : 'כן, מחק את החשבון'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
