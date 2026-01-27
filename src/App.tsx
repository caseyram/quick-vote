import { BrowserRouter, Routes, Route } from 'react-router';
import { useAuth } from './hooks/use-auth';
import Home from './pages/Home';
import AdminSession from './pages/AdminSession';
import ParticipantSession from './pages/ParticipantSession';

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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/:adminToken" element={<AdminSession />} />
        <Route path="/session/:sessionId" element={<ParticipantSession />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
