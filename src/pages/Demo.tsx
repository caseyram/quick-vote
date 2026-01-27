import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface TestMessage {
  id: number;
  content: string;
  created_at: string;
}

interface BroadcastEntry {
  message: string;
  timestamp: string;
  receivedAt: string;
}

interface PgChangeEntry {
  content: string;
  receivedAt: string;
}

export default function Demo() {
  // --- Section 1: Database Read/Write ---
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [inputValue, setInputValue] = useState('');
  const [inserting, setInserting] = useState(false);

  // --- Section 2: Broadcast ---
  const [broadcastLog, setBroadcastLog] = useState<BroadcastEntry[]>([]);
  const [broadcastStatus, setBroadcastStatus] = useState<string>('initializing');

  // --- Section 3: Postgres Changes ---
  const [pgChangesLog, setPgChangesLog] = useState<PgChangeEntry[]>([]);
  const [pgChangesStatus, setPgChangesStatus] = useState<string>('initializing');

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch messages on mount
  useEffect(() => {
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('test_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch messages:', error);
        setDbStatus('error');
      } else {
        setMessages(data ?? []);
        setDbStatus('connected');
      }
    }

    fetchMessages();
  }, []);

  // Set up realtime channel (Broadcast + Postgres Changes)
  useEffect(() => {
    const channel = supabase.channel('demo-room');
    channelRef.current = channel;

    // Broadcast listener
    channel.on('broadcast', { event: 'test_ping' }, (payload) => {
      const entry: BroadcastEntry = {
        message: payload.payload?.message ?? '(no message)',
        timestamp: payload.payload?.timestamp ?? '',
        receivedAt: new Date().toISOString(),
      };
      setBroadcastLog((prev) => [entry, ...prev]);
    });

    // Postgres Changes listener
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'test_messages' },
      (payload) => {
        const newRow = payload.new as TestMessage;
        const entry: PgChangeEntry = {
          content: newRow.content,
          receivedAt: new Date().toISOString(),
        };
        setPgChangesLog((prev) => [entry, ...prev]);
      }
    );

    channel.subscribe((status) => {
      setBroadcastStatus(status);
      setPgChangesStatus(status);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- Handlers ---
  async function handleAddMessage(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || inserting) return;

    setInserting(true);
    const { data, error } = await supabase
      .from('test_messages')
      .insert({ content: trimmed })
      .select();

    if (error) {
      console.error('Failed to insert message:', error);
    } else if (data && data.length > 0) {
      setMessages((prev) => [data[0] as TestMessage, ...prev]);
      setInputValue('');
    }
    setInserting(false);
  }

  async function handleSendBroadcast() {
    const channel = channelRef.current;
    if (!channel) return;

    await channel.send({
      type: 'broadcast',
      event: 'test_ping',
      payload: {
        message: 'Hello from tab!',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // --- Status badge helper ---
  function StatusBadge({ status }: { status: string }) {
    const color =
      status === 'connected' || status === 'SUBSCRIBED'
        ? 'bg-green-500'
        : status === 'error' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'
          ? 'bg-red-500'
          : 'bg-yellow-500';
    const label =
      status === 'SUBSCRIBED' ? 'subscribed' : status.toLowerCase();
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white ${color}`}>
        {label}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">QuickVote</h1>
          <p className="mt-1 text-gray-400">Integration Proof-of-Concept</p>
        </header>

        {/* Section 1: Database Read/Write */}
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Database Read/Write</h2>
            <StatusBadge status={dbStatus} />
          </div>

          <form onSubmit={handleAddMessage} className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type a test message..."
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={inserting || !inputValue.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inserting ? 'Adding...' : 'Add Message'}
            </button>
          </form>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No messages yet.</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="flex justify-between text-sm border-b border-gray-800 py-1">
                  <span className="text-gray-200">{msg.content}</span>
                  <span className="text-gray-500 text-xs">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Section 2: Broadcast Realtime */}
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Broadcast (Pub/Sub) Realtime</h2>
            <StatusBadge status={broadcastStatus} />
          </div>

          <p className="text-sm text-gray-400">
            Open this page in two tabs. Click "Send Broadcast" in one tab -- the message should appear in the other tab.
          </p>

          <button
            onClick={handleSendBroadcast}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Send Broadcast
          </button>

          <div className="max-h-40 overflow-y-auto space-y-1">
            {broadcastLog.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No broadcast messages received yet.</p>
            ) : (
              broadcastLog.map((entry, i) => (
                <div key={i} className="text-sm border-b border-gray-800 py-1">
                  <span className="text-emerald-400">{entry.message}</span>
                  <span className="text-gray-500 text-xs ml-2">
                    sent {new Date(entry.timestamp).toLocaleTimeString()} | received {new Date(entry.receivedAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Section 3: Postgres Changes Realtime */}
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Postgres Changes Realtime</h2>
            <StatusBadge status={pgChangesStatus} />
          </div>

          <p className="text-sm text-gray-400">
            Open this page in two tabs. Add a message in one tab -- the new row should appear in the other tab's Postgres Changes log automatically.
          </p>

          <div className="max-h-40 overflow-y-auto space-y-1">
            {pgChangesLog.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No Postgres change events received yet.</p>
            ) : (
              pgChangesLog.map((entry, i) => (
                <div key={i} className="text-sm border-b border-gray-800 py-1">
                  <span className="text-amber-400">INSERT: {entry.content}</span>
                  <span className="text-gray-500 text-xs ml-2">
                    at {new Date(entry.receivedAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
