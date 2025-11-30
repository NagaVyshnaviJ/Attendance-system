import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { LogOut, LayoutDashboard, Calendar as CalIcon, FileText, Download, FileDown } from 'lucide-react';
import { motion } from 'framer-motion';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import API from './api';
import { loginSuccess, logout } from './store/authSlice';

// --- HELPER ---
const formatDate = (date) => date.toISOString().split('T')[0];

// --- AUTH COMPONENT ---
const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'employee' });
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const { data } = await API.post('/auth/login', { email: formData.email, password: formData.password });
        dispatch(loginSuccess(data));
        navigate('/dashboard');
      } else {
        await API.post('/auth/register', formData);
        alert('Registration Successful! Please Login.');
        setIsLogin(true);
      }
    } catch (err) { alert(err.response?.data || 'Error Occurred'); }
  };

  return (
    <div className="auth-container">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="auth-box">
        <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit}>
          {!isLogin && <input placeholder="Full Name" onChange={e => setFormData({...formData, name: e.target.value})} required />}
          <input type="email" placeholder="Email Address" onChange={e => setFormData({...formData, email: e.target.value})} required />
          <input type="password" placeholder="Password" onChange={e => setFormData({...formData, password: e.target.value})} required />
          {!isLogin && (
            <select onChange={e => setFormData({...formData, role: e.target.value})}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </select>
          )}
          <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
        </form>
        <p style={{textAlign:'center', marginTop:'1rem', cursor:'pointer', color:'#666'}} onClick={()=>setIsLogin(!isLogin)}>
          {isLogin ? "Need account? Register" : "Have account? Login"}
        </p>
      </motion.div>
    </div>
  );
};

// --- EMPLOYEE: HISTORY CALENDAR PAGE ---
const HistoryPage = () => {
    const [history, setHistory] = useState([]);
    const [selectedDateRecords, setSelectedDateRecords] = useState([]);

    useEffect(() => {
      const fetchHistory = async () => {
        try { const { data } = await API.get('/attendance/my-history'); setHistory(data); } catch (err) { console.error(err); }
      };
      fetchHistory();
    }, []);

    const getTileClassName = ({ date, view }) => {
        if (view === 'month') {
            const dateStr = formatDate(date);
            const record = history.find(h => h.date === dateStr);
            if (record) {
                if (record.status === 'Present') return 'cal-present';
                if (record.status === 'Late') return 'cal-late';
                if (record.status === 'Half-day') return 'cal-half';
                return 'cal-absent';
            }
        }
        return null;
    };

    const handleDateClick = (date) => {
        const dateStr = formatDate(date);
        const records = history.filter(h => h.date === dateStr);
        setSelectedDateRecords(records);
    };

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid-container">
        <div className="card" style={{flex: 1, minWidth: '350px'}}>
            <h3>Attendance Calendar</h3>
            <Calendar onClickDay={handleDateClick} tileClassName={getTileClassName} />
            <div className="legend">
                <span className="dot green"></span> Present
                <span className="dot yellow"></span> Late
                <span className="dot red"></span> Absent
            </div>
        </div>
        <div className="card" style={{flex: 1}}>
            <h3>Details for Selected Date</h3>
            {selectedDateRecords.length > 0 ? selectedDateRecords.map(rec => (
                <div key={rec._id} className="detail-box">
                    <p><strong>Date:</strong> {rec.date}</p>
                    <p><strong>Status:</strong> <span className={`status-badge status-${rec.status.toLowerCase()}`}>{rec.status}</span></p>
                    <p><strong>Check In:</strong> {rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString() : '-'}</p>
                    <p><strong>Check Out:</strong> {rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString() : '-'}</p>
                    <p><strong>Hours:</strong> {rec.totalHours}</p>
                </div>
            )) : <p style={{color: '#888'}}>Click a colored date on the calendar to see details.</p>}
        </div>
      </motion.div>
    );
};

// --- MANAGER: REPORTS PAGE ---
const ReportsPage = () => {
    const [filters, setFilters] = useState({ startDate: '', endDate: '', employeeId: 'all' });
    const [employees, setEmployees] = useState([]);
    const [records, setRecords] = useState([]);

    useEffect(() => {
        const loadUsers = async () => { const { data } = await API.get('/users'); setEmployees(data); };
        loadUsers();
    }, []);

    const fetchReport = async () => {
        try {
            const query = `?startDate=${filters.startDate}&endDate=${filters.endDate}&employeeId=${filters.employeeId}`;
            const { data } = await API.get(`/attendance/reports${query}`);
            setRecords(data);
        } catch (err) { alert('Error fetching report'); }
    };

    // --- FIX: Secure Download using Blob ---
    const handleExport = async () => {
        try {
            const query = `?startDate=${filters.startDate}&endDate=${filters.endDate}&employeeId=${filters.employeeId}`;
            const response = await API.get(`/attendance/export${query}`, { responseType: 'blob' });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'attendance_report.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert("Download Failed: Access Denied");
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="header"><h1>Attendance Reports</h1></div>
            <div className="card" style={{marginBottom: '2rem'}}>
                <div className="filters-row">
                    <div><label>Start Date</label><input type="date" onChange={e => setFilters({...filters, startDate: e.target.value})} /></div>
                    <div><label>End Date</label><input type="date" onChange={e => setFilters({...filters, endDate: e.target.value})} /></div>
                    <div><label>Employee</label>
                        <select onChange={e => setFilters({...filters, employeeId: e.target.value})}>
                            <option value="all">All Employees</option>
                            {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
                        </select>
                    </div>
                    <div style={{display:'flex', gap:'10px', marginTop:'auto'}}>
                        <button className="btn btn-primary" onClick={fetchReport}>Filter</button>
                        <button className="btn btn-success" onClick={handleExport}><Download size={16}/> CSV</button>
                    </div>
                </div>
            </div>
            <div className="card">
                <table>
                    <thead><tr><th>Date</th><th>Employee</th><th>Status</th><th>Check In</th><th>Total Hours</th></tr></thead>
                    <tbody>
                        {records.length > 0 ? records.map(rec => (
                            <tr key={rec._id}>
                                <td>{rec.date}</td><td>{rec.userId?.name}</td>
                                <td><span className={`status-badge status-${rec.status.toLowerCase()}`}>{rec.status}</span></td>
                                <td>{rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString() : '-'}</td>
                                <td>{rec.totalHours}</td>
                            </tr>
                        )) : <tr><td colSpan="5" style={{textAlign:'center'}}>No records. Select filters and click Filter.</td></tr>}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

// --- EMPLOYEE DASHBOARD ---
const EmployeeDashboard = ({ user }) => {
  const [stats, setStats] = useState({ present: 0, late: 0, absent: 0, totalHours: 0 });
  const [todayRecord, setTodayRecord] = useState(null);
  const chartData = [{ name: 'Present', value: stats.present, color: '#10B981' }, { name: 'Late', value: stats.late, color: '#F59E0B' }, { name: 'Absent', value: stats.absent, color: '#EF4444' }];
  
  const fetchData = async () => {
      const statsRes = await API.get('/dashboard/employee');
      const todayRes = await API.get('/attendance/today');
      setStats(statsRes.data);
      setTodayRecord(todayRes.data);
  };
  useEffect(() => { fetchData(); }, []);
  const handleAction = async (action) => { try { await API.post(`/attendance/${action}`); fetchData(); } catch (err) { alert(err.response?.data); } };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="header"><h1>Hello, {user.name} 👋</h1><div>{!todayRecord ? <button className="btn btn-primary" onClick={()=>handleAction('checkin')}>Check In</button> : !todayRecord.checkOutTime ? <button className="btn btn-danger" onClick={()=>handleAction('checkout')}>Check Out</button> : <button className="btn btn-success" disabled>Completed</button>}</div></div>
      <div className="grid-container">
        <div className="stats-column">
             <div className="card"><h4>Days Present</h4><p>{stats.present}</p></div>
             <div className="card"><h4>Late Arrivals</h4><p>{stats.late}</p></div>
        </div>
        <div className="card chart-card"><h3>Monthly Summary</h3><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
      </div>
    </motion.div>
  );
};

// --- MANAGER DASHBOARD ---
const ManagerDashboard = () => {
  const [stats, setStats] = useState({ totalEmployees: 0, presentCount: 0, lateCount: 0 });
  const [todayStatus, setTodayStatus] = useState([]);
  const chartData = [{ name: 'Present', count: stats.presentCount }, { name: 'Late', count: stats.lateCount }];
  
  useEffect(() => {
    const fetch = async () => {
      const s = await API.get('/dashboard/manager');
      const t = await API.get('/attendance/today-status');
      setStats(s.data); setTodayStatus(t.data);
    }; fetch();
  }, []);

  // --- FIX: Secure Download for Manager Dashboard ---
  const handleExport = async () => {
      try {
          const response = await API.get('/attendance/export', { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', 'attendance_report.csv');
          document.body.appendChild(link);
          link.click();
          link.remove();
      } catch (err) {
          alert("Download Failed: Access Denied");
      }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="header">
          <h1>Manager Dashboard</h1>
          <button onClick={handleExport} className="btn btn-primary" style={{display:'flex', alignItems:'center', gap:'8px'}}>
            <FileDown size={18} /> Quick Export
          </button>
      </div>
      <div className="stats-grid"><div className="card"><h4>Employees</h4><p>{stats.totalEmployees}</p></div><div className="card"><h4>Present</h4><p>{stats.presentCount}</p></div></div>
      <div className="grid-container" style={{marginTop:'2rem'}}>
        <div className="card" style={{flex:1}}><h3>Who's Present?</h3><ul>{todayStatus.map(rec => <li key={rec._id}>{rec.userId?.name} ({rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString() : ''})</li>)}</ul></div>
        <div className="card chart-card" style={{flex:1}}><ResponsiveContainer width="100%" height={250}><BarChart data={chartData}><XAxis dataKey="name"/><YAxis/><Tooltip/><Bar dataKey="count" fill="#4F46E5"/></BarChart></ResponsiveContainer></div>
      </div>
    </motion.div>
  );
};

// --- LAYOUT ---
const DashboardLayout = ({ children }) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const location = useLocation();
  return (
    <div className="dashboard-layout">
      <div className="sidebar">
        <h3>AttendEase</h3>
        <nav>
          <Link to="/dashboard" className={`nav-link ${location.pathname==='/dashboard'?'active':''}`}><LayoutDashboard size={20}/> Dashboard</Link>
          {user?.role === 'employee' && <Link to="/history" className={`nav-link ${location.pathname==='/history'?'active':''}`}><CalIcon size={20}/> History</Link>}
          {user?.role === 'manager' && <Link to="/reports" className={`nav-link ${location.pathname==='/reports'?'active':''}`}><FileText size={20}/> Reports</Link>}
          <button onClick={()=>dispatch(logout())} className="nav-link logout-btn"><LogOut size={20}/> Logout</button>
        </nav>
      </div>
      <div className="main-content">{children}</div>
    </div>
  );
};

function App() {
  const user = useSelector((state) => state.auth.user);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={!user ? <Auth /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={user ? <DashboardLayout>{user.role==='manager'?<ManagerDashboard/>:<EmployeeDashboard user={user}/>}</DashboardLayout> : <Navigate to="/" />} />
        <Route path="/history" element={user ? <DashboardLayout><HistoryPage/></DashboardLayout> : <Navigate to="/" />} />
        <Route path="/reports" element={user ? <DashboardLayout><ReportsPage/></DashboardLayout> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;