import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useAuth } from './hooks/use-auth';
import { ThemeProvider } from './context/ThemeContext';
import Home from './pages/Home';
import SessionReview from './pages/SessionReview';
import AdminSession from './pages/AdminSession';
import ParticipantSession from './pages/ParticipantSession';
import PresentationView from './pages/PresentationView';
import TemplateEditorPage from './pages/TemplateEditorPage';

function App() {
  const { ready } = useAuth();

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <ThemeProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Navigate to="/" replace />} />
        <Route path="/admin/review/:sessionId" element={<SessionReview />} />
        <Route path="/admin/:adminToken" element={<AdminSession />} />
        <Route path="/presentation/:sessionId" element={<PresentationView />} />
        <Route path="/session/:sessionId" element={<ParticipantSession />} />
        <Route path="/templates/new" element={<TemplateEditorPage />} />
        <Route path="/templates/:id/edit" element={<TemplateEditorPage />} />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
