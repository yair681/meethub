import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

const COLORS = ['#1a73e8','#34a853','#ea4335','#fbbc04','#9c27b0','#00bcd4'];
function Avatar({ name, size = 'md' }) {
  const color = COLORS[(name?.charCodeAt(0) || 0) % COLORS.length];
  const sizes = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-12 h-12 text-lg' };
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
      style={{ background: color }}>
      {name?.charAt(0)?.toUpperCase()}
    </div>
  );
}

function CreateMeetingModal({ onClose, onCreate }) {
  const [type, setType] = useState('instant');
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (type === 'scheduled' && !scheduledAt) { toast.error('בחר תאריך ושעה'); return; }
    setLoading(true);
    try {
      const data = { type, title: title || undefined, password: password || undefined };
      if (type === 'scheduled') data.scheduledAt = scheduledAt;
      const res = await api.post('/meetings', data);
      onCreate(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'יצירת פגישה נכשלה');
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { id: 'instant', label: 'מיידית', desc: 'התחל עכשיו' },
    { id: 'scheduled', label: 'מתוזמנת', desc: 'תכנן מראש' },
    { id: 'permanent', label: 'קבועה', desc: 'קישור קבוע' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ color: '#202124', direction: 'rtl' }}>
        <h2 className="text-xl font-semibold mb-5">יצירת פגישה חדשה</h2>

        <div className="mb-5">
          <label className="block text-sm font-medium mb-2 text-gray-600">סוג פגישה</label>
          <div className="grid grid-cols-3 gap-2">
            {types.map(t => (
              <button key={t.id} onClick={() => setType(t.id)}
                className={`p-3 rounded-xl border-2 text-center transition ${type === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="font-medium text-sm">{t.label}</div>
                <div className="text-xs text-gray-500">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">שם הפגישה (אופציונלי)</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder={type === 'permanent' ? 'החדר שלי' : type === 'scheduled' ? 'סטנדאפ צוותי' : 'שיחה מהירה'}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          {type === 'scheduled' && (
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600">תאריך ושעה</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" dir="ltr" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">סיסמת כניסה (אופציונלי)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="השאר ריק ללא סיסמה"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" dir="ltr" />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">ביטול</button>
          <button onClick={handleCreate} disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'יוצר...' : 'צור פגישה'}
          </button>
        </div>
      </div>
    </div>
  );
}

function JoinModal({ onClose }) {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleJoin = () => {
    const clean = code.trim().toLowerCase();
    if (clean) navigate(`/meet/${clean}`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" style={{ color: '#202124', direction: 'rtl' }}>
        <h2 className="text-xl font-semibold mb-4">הצטרפות לפגישה</h2>
        <input type="text" value={code} onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="הכנס קוד פגישה (לדוגמה: abc-defg-hij)"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-sm"
          dir="ltr" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">ביטול</button>
          <button onClick={handleJoin} disabled={!code.trim()}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            הצטרף
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newResult, setNewResult] = useState(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    api.get('/meetings/my').then(res => setMeetings(res.data));
  }, []);

  const handleCreated = (meeting) => {
    setMeetings(prev => [meeting, ...prev]);
    if (meeting.type === 'instant') {
      navigate(`/meet/${meeting.code}`);
    } else {
      setNewResult(meeting);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('האם למחוק את הפגישה?')) return;
    await api.delete(`/meetings/${id}`);
    setMeetings(prev => prev.filter(m => m.id !== id));
    toast.success('הפגישה נמחקה');
  };

  const copyLink = (code) => {
    navigator.clipboard.writeText(`${window.location.origin}/meet/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
    toast.success('הקישור הועתק!');
  };

  const permanent = meetings.filter(m => m.type === 'permanent');
  const scheduled = meetings.filter(m => m.type === 'scheduled').sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const todayHe = format(new Date(), 'EEEE, d בMMMM', { locale: he });

  return (
    <div className="dashboard-bg">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          </div>
          <span className="text-xl font-semibold text-gray-800">MeetHub</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block">{todayHe}</span>
          {user?.role === 'admin' && (
            <button onClick={() => navigate('/admin')}
              className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium">
              לוח ניהול
            </button>
          )}
          <button onClick={() => navigate('/settings')} className="hover:opacity-80">
            <Avatar name={user?.name} size="sm" />
          </button>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
            יציאה
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="bg-gradient-to-l from-blue-600 to-blue-700 rounded-2xl p-8 mb-8 text-white">
          <h1 className="text-3xl font-semibold mb-1">שלום, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-blue-100 mb-6">התחל או הצטרף לפגישת וידאו מאובטחת</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-white text-blue-700 px-5 py-3 rounded-xl font-semibold hover:bg-blue-50 transition shadow-sm">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
              פגישה חדשה
            </button>
            <button onClick={() => setShowJoin(true)}
              className="flex items-center gap-2 bg-blue-500/30 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-500/50 transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/>
              </svg>
              הצטרף עם קוד
            </button>
          </div>
        </div>

        {/* New meeting banner */}
        {newResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800">הפגישה נוצרה: <span className="font-bold">{newResult.title}</span></p>
              <p className="text-sm text-green-600 font-mono mt-0.5">{newResult.code}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => copyLink(newResult.code)}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                העתק קישור
              </button>
              <button onClick={() => navigate(`/meet/${newResult.code}`)}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                התחל
              </button>
              <button onClick={() => setNewResult(null)} className="text-gray-400 hover:text-gray-600 px-2 text-lg">×</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scheduled */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">📅 פגישות מתוזמנות</h2>
              <button onClick={() => setShowCreate(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ חדשה</button>
            </div>
            {scheduled.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-4xl mb-2">📅</p>
                <p>אין פגישות מתוזמנות</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduled.map(m => (
                  <div key={m.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{m.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {m.scheduled_at ? format(new Date(m.scheduled_at), 'd בMMM yyyy • HH:mm', { locale: he }) : 'ללא זמן'}
                        </p>
                        <p className="text-xs text-gray-400 font-mono mt-1">{m.code}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => copyLink(m.code)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="העתק קישור">
                          {copied === m.code ? '✓' : '🔗'}
                        </button>
                        <button onClick={() => navigate(`/meet/${m.code}`)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          התחל
                        </button>
                        <button onClick={() => handleDelete(m.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Permanent */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">🔗 חדרים קבועים</h2>
              <button onClick={() => setShowCreate(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ חדש</button>
            </div>
            {permanent.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-4xl mb-2">🔗</p>
                <p>אין חדרים קבועים</p>
                <p className="text-sm mt-1">צור חדר עם קישור קבוע</p>
              </div>
            ) : (
              <div className="space-y-3">
                {permanent.map(m => (
                  <div key={m.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{m.title}</p>
                        <p className="text-xs text-gray-400 font-mono mt-1">{m.code}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => copyLink(m.code)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="העתק קישור">
                          {copied === m.code ? '✓' : '🔗'}
                        </button>
                        <button onClick={() => navigate(`/meet/${m.code}`)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          כנס
                        </button>
                        <button onClick={() => handleDelete(m.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && <CreateMeetingModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />}
      {showJoin && <JoinModal onClose={() => setShowJoin(false)} />}
    </div>
  );
}
