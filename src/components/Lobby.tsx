interface LobbyProps {
  title: string;
}

export default function Lobby({ title }: LobbyProps) {
  return (
    <div
      className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4"
      style={{ minHeight: '100dvh' }}
    >
      <h1 className="text-3xl font-bold text-white mb-4 text-center">{title}</h1>
      <p className="text-gray-400 text-lg">Waiting for host to start...</p>
    </div>
  );
}
