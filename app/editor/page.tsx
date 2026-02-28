"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CodeEditor from '@/components/CodeEditor';
import { Loader2 } from 'lucide-react';

function EditorContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room');
  const username = searchParams.get('username');
  const [isLoading, setIsLoading] = useState(true);
  const [roomData, setRoomData] = useState<any>(null);

  useEffect(() => {
    if (roomId) {
      fetchRoomData();
    }
  }, [roomId]);

  const fetchRoomData = async () => {
    try {
      const response = await fetch(`/api/rooms?roomId=${roomId}`);
      if (response.ok) {
        const data = await response.json();
        setRoomData(data);
      }
    } catch (error) {
      console.error('Error fetching room data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!roomId || !username) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Room</h1>
          <p className="text-zinc-400">Please join a room from the homepage.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  const initialCode = roomData?.codeSnapshots?.[0]?.code;
  const initialLanguage = roomData?.codeSnapshots?.[0]?.language;

  return (
    <div className="h-screen">
      <CodeEditor
        roomId={roomId}
        username={username}
        initialCode={initialCode}
        initialLanguage={initialLanguage}
      />
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
