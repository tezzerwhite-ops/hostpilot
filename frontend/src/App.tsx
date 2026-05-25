import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import Calendar from './pages/Calendar';
import ConnectChannel from './pages/ConnectChannel';
import OAuthCallback from './pages/OAuthCallback';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />}>
          <Route index element={<Inbox />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="connect" element={<ConnectChannel />} />
        </Route>
        <Route path="/channels/success" element={<OAuthCallback />} />
        <Route path="/channels/error" element={<OAuthCallback />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
