import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('הסיסמה חייבת להכיל לפחות 6 תווים'); return; }
    setLoading(true);
    try {
      await register(email, name, password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'ההרשמה נכשלה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)' }}>
      <div className="auth-card">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            </div>
            <span className="text-2xl font-bold text-gray-800">MeetHub</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">יצירת חשבון</h1>
          <p className="text-gray-500 mt-1">הצטרף ל-MeetHub היום</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              placeholder="הכנס את שמך" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">דואר אלקטרוני</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              placeholder="הכנס את האימייל שלך" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              placeholder="לפחות 6 תווים" dir="ltr" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? 'יוצר חשבון...' : 'יצירת חשבון'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-gray-500 text-sm">כבר יש לך חשבון? </span>
          <Link to="/login" className="text-blue-600 text-sm font-medium hover:underline">כניסה</Link>
        </div>
      </div>
    </div>
  );
}
