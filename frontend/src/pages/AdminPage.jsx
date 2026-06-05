import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { socket } from '../socket';
import api from '../api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold mt-1" style={{ color }}>{value ?? '-'}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [meetings, setMeetings] = useState([]);
  const [activeMeetings, setActiveMeetings] = useState([]);
  const [settings, setSettings] = useState({});
  const [tab, setTab] = useState('users');
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/users'),
      api.get('/admin/stats'),
      api.get('/admin/meetings'),
      api.get('/admin/settings')
    ]).then(([u, s, m, st]) => {
      setUsers(u.data);
      setStats(s.data);
      setMeetings(m.data);
      setSettings(st.data);
    }).finally(() => setLoading(false));

    socket.connect();
    socket.on('active-meetings-update', data => setActiveMeetings(data));
    return () => { socket.off('active-meetings-update'); socket.disconnect(); };
  }, []);

  const handleDeleteUser = async (id) => {
    if (!confirm('למחוק משתמש זה? כל הפגישות שלו ימחקו גם כן.')) return;
    await api.delete(`/admin/users/${id}`);
    setUsers(prev => prev.filter(u => u.id !== id));
    toast.success('המשתמש נמחק');
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role });
  };

  const handleUpdateUser = async () => {
    try {
      const res = await api.patch(`/admin/users/${editUser.id}`, editForm);
      setUsers(prev => prev.map(u => u.id === editUser.id ? res.data : u));
      setEditUser(null);
      toast.success('המשתמש עודכן');
    } catch (err) {
      toast.error(err.response?.data?.error || 'העדכון נכשל');
    }
  };

  const handleToggleSetting = async (key, current) => {
    const newVal = current === 'true' ? 'false' : 'true';
    await api.patch('/admin/settings', { [key]: newVal });
    setSettings(prev => ({ ...prev, [key]: newVal }));
    toast.success(newVal === 'true' ? 'יצירת פגישות הופעלה' : 'יצירת פגישות נחסמה');
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const COLORS = ['#1a73e8','#34a853','#ea4335','#fbbc04'];

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: '#f8f9fa' }}>
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa', color: '#202124', direction: 'rtl' }}>
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ transform: 'scaleX(-1)' }}>
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>
          <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          </div>
          <span className="font-semibold text-gray-800">לוח ניהול MeetHub</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.name}</span>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">יציאה</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="סה״כ משתמשים" value={stats.totalUsers} icon="👥" color="#1a73e8" />
          <StatCard label="סה״כ פגישות" value={stats.totalMeetings} icon="📹" color="#34a853" />
          <StatCard label="פגישות פעילות" value={activeMeetings.length} icon="🔴" color="#ea4335" />
          <StatCard label="פגישות מתוזמנות" value={stats.scheduledMeetings} icon="📅" color="#fbbc04" />
        </div>

        {/* System settings */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">הגדרות מערכת</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-700">אפשר למשתמשים ליצור פגישות</p>
              <p className="text-sm text-gray-500">כאשר מבוטל, רק מנהלים יוכלו ליצור פגישות</p>
            </div>
            <button
              onClick={() => handleToggleSetting('can_create_meetings', settings.can_create_meetings)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                settings.can_create_meetings === 'true' ? 'bg-blue-600' : 'bg-gray-300'
              }`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                settings.can_create_meetings === 'true' ? 'translate-x-1' : 'translate-x-6'
              }`} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
          {[
            { id: 'users', label: '👥 משתמשים' },
            { id: 'meetings', label: '📋 כל הפגישות' },
            { id: 'active', label: '🔴 פגישות חיות' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Users */}
        {tab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="חפש משתמשים..."
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-sm text-gray-500">{filtered.length} משתמשים</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['שם', 'אימייל', 'תפקיד', 'נרשם', 'פעולות'].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                            style={{ background: COLORS[(u.name?.charCodeAt(0) || 0) % COLORS.length] }}>
                            {u.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800 text-sm">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dir-ltr" dir="ltr">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                        }`}>{u.role === 'admin' ? 'מנהל' : 'משתמש'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {format(new Date(u.created_at), 'd בMMM yyyy', { locale: he })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(u)}
                            className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                            עריכה
                          </button>
                          {u.id !== user?.id && (
                            <button onClick={() => handleDeleteUser(u.id)}
                              className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                              מחיקה
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="text-center py-12 text-gray-400">לא נמצאו משתמשים</div>}
            </div>
          </div>
        )}

        {/* All meetings */}
        {tab === 'meetings' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['שם', 'קוד', 'מנהל', 'סוג', 'סטטוס', 'נוצר'].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {meetings.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.title}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-500" dir="ltr">{m.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{m.host_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          m.type === 'instant' ? 'bg-orange-100 text-orange-700' :
                          m.type === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {m.type === 'instant' ? 'מיידית' : m.type === 'scheduled' ? 'מתוזמנת' : 'קבועה'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          m.status === 'active' ? 'bg-green-100 text-green-700' :
                          m.status === 'ended' ? 'bg-gray-100 text-gray-500' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {m.status === 'active' ? 'פעילה' : m.status === 'ended' ? 'הסתיימה' : 'מתוזמנת'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {format(new Date(m.created_at), 'd בMMM yyyy', { locale: he })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {meetings.length === 0 && <div className="text-center py-12 text-gray-400">אין פגישות עדיין</div>}
            </div>
          </div>
        )}

        {/* Live meetings */}
        {tab === 'active' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500">{activeMeetings.length} פגישות פעילות כרגע</span>
            </div>
            {activeMeetings.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">
                <p className="text-5xl mb-3">📹</p>
                <p>אין פגישות פעילות כרגע</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {activeMeetings.map(m => (
                  <div key={m.code} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="font-mono text-gray-800 font-medium" dir="ltr">{m.code}</span>
                      <span className="text-sm text-gray-500">• {m.count} משתתפ{m.count !== 1 ? 'ים' : ''}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {m.participants.map(p => (
                        <div key={p.socketId} className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-full text-sm">
                          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                            {p.userName?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="text-gray-700">{p.userName}</span>
                          {!p.audio && <span className="text-red-400 text-xs">🔇</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">עריכת משתמש</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">שם</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">אימייל</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">תפקיד</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="user">משתמש</option>
                  <option value="admin">מנהל</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditUser(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
                ביטול
              </button>
              <button onClick={handleUpdateUser}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                שמור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
