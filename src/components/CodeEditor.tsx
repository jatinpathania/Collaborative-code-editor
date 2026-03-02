"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { io, Socket } from 'socket.io-client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Play, Save, Download, Trash2, Terminal, Wifi, WifiOff, PanelRight, PanelLeft, PanelTop, PanelBottom } from 'lucide-react';
import { executeCode } from '@/lib/docker-executor';
import { useToast } from '@/components/ui/use-toast';

interface CodeEditorProps {
  roomId: string;
  username: string;
  initialCode?: string;
  initialLanguage?: string;
}

const LANGUAGES = [
  {
    value: 'javascript',
    label: 'JavaScript',
    defaultCode: `const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const lines = [];
rl.on('line', (line) => lines.push(line));
rl.on('close', () => {
  const name = lines[0] || 'World';
  console.log('Hello, ' + name + '!');
});`,
    inputHint: 'e.g. Alice',
  },
  {
    value: 'python',
    label: 'Python',
    defaultCode: `name = input("Enter your name: ")
print(f"Hello, {name}!")`,
    inputHint: 'e.g. Alice',
  },
  {
    value: 'java',
    label: 'Java',
    defaultCode: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String name = sc.nextLine();
        System.out.println("Hello, " + name + "!");
    }
}`,
    inputHint: 'e.g. Alice',
  },
  {
    value: 'cpp',
    label: 'C++',
    defaultCode: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    cin >> name;
    cout << "Hello, " << name << "!" << endl;
    return 0;
}`,
    inputHint: 'e.g. Alice',
  },
  {
    value: 'c',
    label: 'C',
    defaultCode: `#include <stdio.h>

int main() {
    char name[100];
    scanf("%s", name);
    printf("Hello, %s!\\n", name);
    return 0;
}`,
    inputHint: 'e.g. Alice',
  },
];

const THEMES = [
  { value: 'vs-dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'hc-black', label: 'High Contrast' },
];

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-red-500',
  'bg-indigo-500',
  'bg-yellow-500',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function CodeEditor({ roomId, username, initialCode, initialLanguage }: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const isRemoteChange = useRef(false);

  const [language, setLanguage] = useState(initialLanguage || 'javascript');
  const [theme, setTheme] = useState('vs-dark');
  const [code, setCode] = useState(initialCode || LANGUAGES[0].defaultCode);
  const [output, setOutput] = useState('');
  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([username]);
  const [isConnected, setIsConnected] = useState(false);
  const [panelPosition, setPanelPosition] = useState<'right' | 'left' | 'bottom' | 'top'>('right');
  const { toast } = useToast();

  useEffect(() => {
    const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';

    let isMounted = true;

    const initSocket = async () => {
      try {
        await fetch('/api/init-socket');
      } catch (err) {
        console.error('Failed to initialize socket:', err);
      }

      if (!isMounted) return;

      const socket = io(socketUrl, {
        path: '/api/socket',
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        if (!isMounted) {
          socket.disconnect();
          return;
        }
        console.log(`[Socket] Connected! ID: ${socket.id}`);
        setIsConnected(true);
        const cleanRoomId = roomId.trim();
        console.log(`[Socket] Joining Room: "${cleanRoomId}" as "${username}"`);
        socket.emit('join-room', { roomId: cleanRoomId, username });
      });

      socket.on('connect_error', (err) => {
        if (!isMounted) return;
        console.error('[Socket] Connection Error:', err.message);
        toast({
          title: 'Connection Error',
          description: `Failed to connect to ${socketUrl || 'local server'}.`,
          variant: 'destructive',
        });
      });

      socket.on('disconnect', (reason) => {
        setIsConnected(false);
      });

      socket.on('code-change', ({ code: remoteCode }: { code: string }) => {
        if (editorRef.current && isMounted) {
          isRemoteChange.current = true;
          const model = editorRef.current.getModel();
          if (model && model.getValue() !== remoteCode) {
            editorRef.current.setValue(remoteCode);
          }
          isRemoteChange.current = false;
        }
        setCode(remoteCode);
      });

      socket.on('room-state', ({ code: snapCode, language: snapLang, input: snapInput, output: snapOutput, executionTime: snapTime }: {
        code?: string; language?: string; input?: string; output?: string; error?: string; executionTime?: number;
      }) => {
        if (!isMounted) return;
        isRemoteChange.current = true;
        if (snapCode !== undefined) {
          setCode(snapCode);
          if (editorRef.current) editorRef.current.setValue(snapCode);
        }
        if (snapLang !== undefined) setLanguage(snapLang);
        if (snapInput !== undefined) setInput(snapInput);
        if (snapOutput !== undefined) setOutput(snapOutput);
        if (snapTime !== undefined) setExecutionTime(snapTime);
        isRemoteChange.current = false;
      });

      socket.on('language-change', ({ language: remoteLang, code: remoteCode }: { language: string; code?: string }) => {
        if (!isMounted) return;
        isRemoteChange.current = true;
        setLanguage(remoteLang);
        const newCode = remoteCode ?? (LANGUAGES.find(l => l.value === remoteLang)?.defaultCode || '');
        setCode(newCode);
        if (editorRef.current) editorRef.current.setValue(newCode);
        isRemoteChange.current = false;
      });

      socket.on('users-update', (users: string[]) => {
        if (!isMounted) return;
        setOnlineUsers(users);
      });

      socket.on('execution-start', () => {
        if (!isMounted) return;
        setIsExecuting(true);
        setOutput('⏳ Executing...');
        setExecutionTime(null);
      });

      socket.on('execution-result', ({ output: remoteOutput, error, executionTime: time }: {
        output: string; error?: string; executionTime: number;
      }) => {
        if (!isMounted) return;
        setIsExecuting(false);
        setExecutionTime(time);
        if (error) {
          const combined = [remoteOutput, error].filter(Boolean).join('\n--- Error ---\n');
          setOutput(combined);
        } else {
          setOutput(remoteOutput || '(Program exited with no output)');
        }
      });

      socket.on('input-change', ({ input: remoteInput }: { input: string }) => {
        if (!isMounted) return;
        setInput(remoteInput);
      });
    };

    initSocket();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId, username, toast]);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleCodeChange = useCallback((value: string | undefined) => {
    const newCode = value || '';
    setCode(newCode);
    if (!isRemoteChange.current && socketRef.current) {
      socketRef.current.emit('code-change', { roomId, code: newCode });
    }
  }, [roomId]);

  const handleInputChange = useCallback((newInput: string) => {
    setInput(newInput);
    if (socketRef.current) {
      socketRef.current.emit('input-change', { roomId, input: newInput });
    }
  }, [roomId]);

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    const langConfig = LANGUAGES.find(l => l.value === newLanguage);
    const newCode = langConfig?.defaultCode || '';
    setCode(newCode);
    if (socketRef.current) {
      socketRef.current.emit('language-change', { roomId, language: newLanguage, code: newCode });
    }
  };

  const handleRunCode = async () => {
    setIsExecuting(true);
    setOutput('⏳ Executing...');
    setExecutionTime(null);

    if (socketRef.current) {
      socketRef.current.emit('execution-start', { roomId });
    }

    try {
      const result = await executeCode({ code, language, input });
      setExecutionTime(result.executionTime);

      if (result.error) {
        const combined = [result.output, result.error].filter(Boolean).join('\n--- Error ---\n');
        setOutput(combined);
        if (socketRef.current) {
          socketRef.current.emit('execution-result', {
            roomId,
            output: result.output || '',
            error: result.error,
            executionTime: result.executionTime,
          });
        }
        toast({ title: 'Execution Error', description: result.error.slice(0, 120), variant: 'destructive' });
      } else {
        const finalOutput = result.output || '(Program exited with no output)';
        setOutput(finalOutput);
        if (socketRef.current) {
          socketRef.current.emit('execution-result', {
            roomId,
            output: finalOutput,
            executionTime: result.executionTime,
          });
        }
        toast({ title: '✅ Executed', description: `Done in ${result.executionTime}ms` });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setOutput(`Error: ${errorMsg}`);
      if (socketRef.current) {
        socketRef.current.emit('execution-result', {
          roomId,
          output: '',
          error: errorMsg,
          executionTime: 0,
        });
      }
      toast({ title: 'Execution Failed', description: errorMsg, variant: 'destructive' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveCode = async () => {
    try {
      const response = await fetch('/api/code/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, code, language }),
      });
      if (response.ok) {
        toast({ title: 'Saved', description: 'Code saved successfully!' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save code', variant: 'destructive' });
    }
  };

  const handleDownloadCode = () => {
    const extension = language === 'javascript' ? 'js'
      : language === 'python' ? 'py'
        : language === 'java' ? 'java'
          : language === 'cpp' ? 'cpp' : 'c';

    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {isConnected
              ? <Wifi className="w-3.5 h-3.5 text-green-400" />
              : <WifiOff className="w-3.5 h-3.5 text-zinc-500" />}
            <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-zinc-500'}`}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <div className="text-zinc-600">|</div>
          <div className="text-sm text-zinc-400">Room: <span className="text-zinc-300 font-mono">{roomId.slice(0, 12)}…</span></div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 bg-zinc-800 border border-zinc-700 rounded-md p-0.5" title="IO Panel Position">
            {([
              { pos: 'top', Icon: PanelTop, label: 'Top' },
              { pos: 'left', Icon: PanelLeft, label: 'Left' },
              { pos: 'right', Icon: PanelRight, label: 'Right' },
              { pos: 'bottom', Icon: PanelBottom, label: 'Bottom' },
            ] as const).map(({ pos, Icon, label }) => (
              <button
                key={pos}
                type="button"
                title={`Panel ${label}`}
                onClick={() => setPanelPosition(pos)}
                className={`p-1.5 rounded transition-colors ${panelPosition === pos
                  ? 'bg-green-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[160px] bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(lang => (
                <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger className="w-[130px] bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleDownloadCode} variant="outline" size="sm" className="bg-zinc-800 border-zinc-700">
            <Download className="w-4 h-4 mr-2" />Download
          </Button>

          <Button onClick={handleSaveCode} variant="outline" size="sm" className="bg-zinc-800 border-zinc-700">
            <Save className="w-4 h-4 mr-2" />Save
          </Button>

          <Button onClick={handleRunCode} disabled={isExecuting} className="bg-green-600 hover:bg-green-700" size="sm">
            <Play className="w-4 h-4 mr-2" />
            {isExecuting ? 'Running…' : 'Run Code'}
          </Button>
        </div>
      </div>

      {(() => {
        const isHorizontal = panelPosition === 'left' || panelPosition === 'right';
        const borderClass = panelPosition === 'right' ? 'border-l border-zinc-800'
          : panelPosition === 'left' ? 'border-r border-zinc-800'
            : panelPosition === 'bottom' ? 'border-t border-zinc-800'
              : 'border-b border-zinc-800';
        const panelSizeClass = isHorizontal ? 'w-[400px] shrink-0' : 'h-[280px] shrink-0 w-full';
        const bodyFlexClass =
          panelPosition === 'right' ? 'flex-row'
            : panelPosition === 'left' ? 'flex-row-reverse'
              : panelPosition === 'top' ? 'flex-col-reverse'
                : 'flex-col';
        const usersFlexClass = isHorizontal ? 'flex-col' : 'flex-row items-start gap-4';
        const ioFlexClass = isHorizontal ? 'flex-col' : 'flex-row gap-4 flex-1';

        return (
          <div className={`flex-1 flex ${bodyFlexClass} overflow-hidden`}>
            <div className="flex-1 min-w-0 min-h-0">
              <Editor
                height="100%"
                language={language}
                value={code}
                theme={theme}
                onChange={handleCodeChange}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: true,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  formatOnPaste: true,
                  formatOnType: true,
                }}
              />
            </div>

            <div className={`${panelSizeClass} ${borderClass} bg-zinc-900 flex ${usersFlexClass} overflow-hidden`}>
              <div className={`${isHorizontal ? 'border-b border-zinc-800' : 'border-r border-zinc-800 w-48 shrink-0 flex flex-col overflow-auto'}`}>
                <div className="px-4 py-2 bg-zinc-800/80 border-b border-zinc-700 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-semibold text-sm">Online</span>
                  </div>
                  <span className="text-xs text-zinc-500">{onlineUsers.length} user{onlineUsers.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="p-3 flex flex-wrap gap-2 overflow-auto">
                  {onlineUsers.map((user, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
                      <div className={`w-6 h-6 rounded-full ${avatarColor(user)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                        {user.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-zinc-200">{user}</span>
                      {user === username && (
                        <span className="text-xs text-zinc-500">(you)</span>
                      )}
                    </div>
                  ))}
                  {onlineUsers.length === 0 && (
                    <p className="text-xs text-zinc-600 italic">No users connected</p>
                  )}
                </div>
              </div>

              <div className={`flex ${ioFlexClass} overflow-hidden min-h-0`}>
                <div className={`${isHorizontal ? 'border-b border-zinc-800' : 'flex-1 border-r border-zinc-800'} flex flex-col`}>
                  <div className="px-4 py-2 bg-zinc-800/80 border-b border-zinc-700 font-semibold text-sm flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-green-400" />
                      <span>Standard Input</span>
                    </div>
                    {input && (
                      <button
                        onClick={() => handleInputChange('')}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />Clear
                      </button>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <p className="text-xs text-zinc-500 mb-2">
                      💡 Type your program&apos;s input here before running.
                    </p>
                    <textarea
                      className="flex-1 min-h-[64px] w-full bg-zinc-950 border border-zinc-700 rounded-md p-3 text-sm text-zinc-100 font-mono outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none placeholder:text-zinc-600"
                      placeholder={`Enter input for your program...\nEach line = one Enter press.`}
                      value={input}
                      onChange={e => handleInputChange(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                </div>

                <div className={`${isHorizontal ? 'flex-1' : 'flex-1'} flex flex-col min-h-0 overflow-hidden`}>
                  <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-b border-zinc-700 shrink-0">
                    <span className="font-semibold text-sm">Output</span>
                    {executionTime !== null && (
                      <span className="text-xs text-zinc-500">⏱ {executionTime}ms</span>
                    )}
                  </div>
                  <div className="flex-1 p-4 overflow-auto">
                    <pre className={`text-sm font-mono whitespace-pre-wrap ${output.startsWith('Error') || output.includes('--- Error ---')
                      ? 'text-red-400'
                      : output.startsWith('⏳')
                        ? 'text-zinc-500 italic'
                        : 'text-zinc-200'
                      }`}>
                      {output || '▶ Run your code to see output here…'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
