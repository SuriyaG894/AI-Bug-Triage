import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import BugListPage from './pages/BugListPage';
import BugFormPage from './pages/BugFormPage';
import BugDetailPage from './pages/BugDetailPage';
import BugEditPage from './pages/BugEditPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminPage from './pages/AdminPage';
import AuditPage from './pages/AuditPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/" element={<Layout><ProtectedRoute><HomePage /></ProtectedRoute></Layout>} />
          <Route path="/bugs" element={<Layout><ProtectedRoute><BugListPage /></ProtectedRoute></Layout>} />
          <Route path="/bugs/new" element={<Layout><ProtectedRoute><BugFormPage /></ProtectedRoute></Layout>} />
          <Route path="/bugs/:id/edit" element={<Layout><ProtectedRoute><BugEditPage /></ProtectedRoute></Layout>} />
          <Route path="/bugs/:id" element={<Layout><ProtectedRoute><BugDetailPage /></ProtectedRoute></Layout>} />
          <Route path="/profile" element={<Layout><ProtectedRoute><ProfilePage /></ProtectedRoute></Layout>} />
          <Route path="/audit" element={<Layout><ProtectedRoute><AuditPage /></ProtectedRoute></Layout>} />
          <Route path="/admin" element={<Layout><ProtectedRoute><AdminPage /></ProtectedRoute></Layout>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
