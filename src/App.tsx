import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router';
import { useAuth } from './hooks/use-auth';
import { ThemeProvider } from './context/ThemeContext';
import { PresentationThemeProvider } from './context/PresentationThemeContext';
import Home from './pages/Home';
import SessionReview from './pages/SessionReview';
import AdminSession from './pages/AdminSession';
import ParticipantSession from './pages/ParticipantSession';
import PresentationView from './pages/PresentationView';
import TemplateEditorPage from './pages/TemplateEditorPage';

function RootLayout() {
  return (
    <ThemeProvider>
      <PresentationThemeProvider>
        <Outlet />
      </PresentationThemeProvider>
    </ThemeProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/admin', element: <Navigate to="/" replace /> },
      { path: '/admin/review/:sessionId', element: <SessionReview /> },
      { path: '/admin/:adminToken', element: <AdminSession /> },
      { path: '/presentation/:adminToken', element: <PresentationView /> },
      { path: '/session/:sessionId', element: <ParticipantSession /> },
      { path: '/templates/new', element: <TemplateEditorPage /> },
      { path: '/templates/:id/edit', element: <TemplateEditorPage /> },
    ],
  },
]);

function App() {
  const { ready } = useAuth();

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading...</p>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export default App;
