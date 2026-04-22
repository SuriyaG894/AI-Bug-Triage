import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import BugListPage from './pages/BugListPage';
import BugFormPage from './pages/BugFormPage';
import BugDetailPage from './pages/BugDetailPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/bugs" element={<BugListPage />} />
          <Route path="/bugs/new" element={<BugFormPage />} />
          <Route path="/bugs/:id" element={<BugDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
