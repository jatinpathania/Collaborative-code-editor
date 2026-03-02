"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Code2, Users, Zap, Shield, Shuffle, ArrowRight, Terminal, Globe, Lock, Activity, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';


const DEMO_LINES = [
  { code: 'const greet = (name) => {', color: '#c792ea' },
  { code: '  return `Hello, ${name}!`;', color: '#c3e88d' },
  { code: '};', color: '#c792ea' },
  { code: '', color: '' },
  { code: 'greet("World");', color: '#82aaff' },
];

function TypingDemo() {
  const [lines, setLines] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const blinkTimer = setInterval(() => setBlink(b => !b), 530);
    return () => clearInterval(blinkTimer);
  }, []);

  useEffect(() => {
    if (lineIdx >= DEMO_LINES.length) {
      const reset = setTimeout(() => {
        setLines([]); setCurrent(''); setLineIdx(0); setCharIdx(0);
      }, 2800);
      return () => clearTimeout(reset);
    }
    const target = DEMO_LINES[lineIdx].code;
    if (charIdx <= target.length) {
      const t = setTimeout(() => {
        setCurrent(target.slice(0, charIdx));
        setCharIdx(c => c + 1);
      }, target === '' ? 20 : 55);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setLines(prev => [...prev, { text: target, color: DEMO_LINES[lineIdx].color }] as any);
        setCurrent('');
        setCharIdx(0);
        setLineIdx(l => l + 1);
      }, 280);
      return () => clearTimeout(t);
    }
  }, [lineIdx, charIdx]);

  return (
    <div className="font-mono text-sm leading-7 select-none">
      {(lines as any[]).map((l, i) => (
        <div key={i} style={{ color: l.color || '#637777' }}>{l.text || '\u00a0'}</div>
      ))}
      {lineIdx < DEMO_LINES.length && (
        <div style={{ color: DEMO_LINES[lineIdx].color || '#e8f4f8' }}>
          {current}
          <span className={`inline-block w-0.5 h-4 bg-emerald-400 ml-px align-middle transition-opacity ${blink ? 'opacity-100' : 'opacity-0'}`} />
        </div>
      )}
    </div>
  );
}


function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
      <span className="text-xs text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}


function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group flex gap-4 p-5 rounded-2xl border border-white/5 hover:border-emerald-500/30 hover:bg-white/[0.03] transition-all duration-300">
      <div className="mt-0.5 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-white mb-1 text-sm">{title}</p>
        <p className="text-slate-500 text-xs leading-relaxed">{body}</p>
      </div>
    </div>
  );
}


const LANGS = [
  { name: 'JavaScript', dot: '#f7df1e' },
  { name: 'Python', dot: '#3572a5' },
  { name: 'Java', dot: '#b07219' },
  { name: 'C++', dot: '#f34b7d' },
  { name: 'C', dot: '#555555' },
];


export default function Home() {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const generateRoomId = () => {
    setRoomId(String(Math.floor(100000 + Math.random() * 900000)));
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim()) {
      toast({ title: 'Missing fields', description: 'Enter a username and Room ID.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, roomName: roomId }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/editor?room=${data.room.id}&username=${username}`);
      } else {
        toast({ title: 'Error', description: 'Could not join room.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach server.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#080b10] text-white overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

     
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-sky-500/8 blur-[100px]" />
      
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      
      <header className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Code2 className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-lg tracking-tight">CodeSync</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#languages" className="hover:text-white transition-colors">Languages</a>
          <a href="#join" className="flex items-center gap-1 px-4 py-2 rounded-full border border-white/10 hover:border-emerald-500/50 hover:text-white transition-all text-white/80">
            Get Started <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </nav>
      </header>

     
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-16 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

         
          <div>
           
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Real-time · Multi-language · Docker-powered
            </div>

            <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight mb-6">
              Code together,
              <br />
              <span className="relative">
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
                  ship faster.
                </span>
                <svg className="absolute -bottom-1 left-0 w-full h-2 opacity-40" viewBox="0 0 300 8" preserveAspectRatio="none">
                  <path d="M0 7 Q75 1 150 5 Q225 9 300 3" stroke="#34d399" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-lg">
              A real-time collaborative editor with live cursors, shared execution, and isolated Docker sandboxes — built for engineering teams.
            </p>

          
            <div id="join" className="relative rounded-2xl overflow-hidden">
            
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-transparent to-violet-500/10 p-px">
                <div className="w-full h-full rounded-2xl bg-[#0d1117]" />
              </div>
              <div className="relative p-7">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-5">Join a session</p>
                <form onSubmit={handleJoin} className="space-y-4">
                
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Your name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 transition-all"
                      required
                    />
                  </div>

                
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-slate-400 font-medium">Room ID</label>
                      <button type="button" onClick={generateRoomId}
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                        <Shuffle className="w-3 h-3" /> Generate
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="6-digit code"
                        value={roomId}
                        maxLength={6}
                        onChange={e => setRoomId(e.target.value)}
                        className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm font-mono tracking-[0.3em] outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 transition-all"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        required
                      />
                      <button type="button" onClick={generateRoomId} title="Generate"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors">
                        <Shuffle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-60 disabled:cursor-not-allowed mt-2">
                    {isLoading ? (
                      <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Joining…</span>
                    ) : (
                      <><ArrowRight className="w-4 h-4" /> Enter Room</>
                    )}
                  </button>
                </form>
              </div>
            </div>

           
            <div className="flex items-center gap-10 mt-8 pl-1">
              <Stat value="5" label="Languages" />
              <div className="w-px h-8 bg-white/10" />
              <Stat value="<2s" label="Spin-up" />
              <div className="w-px h-8 bg-white/10" />
              <Stat value="∞" label="Rooms" />
            </div>
          </div>

          
          <div className="hidden lg:block relative">
       
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-violet-500/5 blur-2xl scale-105" />
          
            <div className="relative rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden">
            
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                <span className="ml-3 text-xs text-slate-600 font-mono">main.js — CodeSync</span>
                <div className="ml-auto flex items-center gap-1.5 text-emerald-400 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  2 live
                </div>
              </div>
              
              <div className="p-6" style={{ fontFamily: "'JetBrains Mono', monospace", minHeight: '280px' }}>
               
                <div className="flex gap-5 text-sm">
                  <div className="text-slate-700 select-none text-right leading-7" style={{ minWidth: '1.5rem' }}>
                    {Array.from({ length: 7 }, (_, i) => <div key={i}>{i + 1}</div>)}
                  </div>
                  <TypingDemo />
                </div>
              </div>
              
              <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/5 bg-white/[0.02] text-xs text-slate-600">
                <span className="flex items-center gap-1.5"><Activity className="w-3 h-3 text-emerald-500" /> Connected</span>
                <span>JavaScript · UTF-8</span>
                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ln 5, Col 14</span>
              </div>
            </div>

         
            <div className="absolute -bottom-5 -right-5 flex -space-x-2.5">
              {['H', 'A', 'R'].map((l, i) => (
                <div key={i} className="w-9 h-9 rounded-full border-2 border-[#080b10] flex items-center justify-center text-xs font-bold shadow-lg"
                  style={{ background: ['#10b981', '#8b5cf6', '#3b82f6'][i], color: '#fff' }}>
                  {l}
                </div>
              ))}
              <div className="w-9 h-9 rounded-full border-2 border-[#080b10] bg-white/10 flex items-center justify-center text-xs text-slate-400">+3</div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-8 pb-24">
        <div className="mb-10">
          <p className="text-xs text-emerald-400 uppercase tracking-widest font-medium mb-3">Why CodeSync</p>
          <h2 className="text-3xl font-bold tracking-tight">Everything your team needs</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-3">
          <Feature icon={<Users className="w-5 h-5 text-emerald-400" />}
            title="Real-time collaboration"
            body="Live cursor tracking, instant code sync via WebSockets. Everyone sees every keystroke." />
          <Feature icon={<Terminal className="w-5 h-5 text-sky-400" />}
            title="Shared execution"
            body="Run code once, everyone in the room sees the output simultaneously." />
          <Feature icon={<Lock className="w-5 h-5 text-violet-400" />}
            title="Isolated sandboxes"
            body="Every execution runs in its own Docker container — no interference, no leaks." />
          <Feature icon={<Globe className="w-5 h-5 text-orange-400" />}
            title="Anywhere, instantly"
            body="No installs. Open a browser, share your 6-digit Room ID, start coding." />
        </div>
      </section>

      {/* ── Languages ── */}
      <section id="languages" className="relative z-10 max-w-7xl mx-auto px-8 pb-28">
        <div className="flex items-center gap-6 flex-wrap">
          <span className="text-xs text-slate-600 uppercase tracking-widest shrink-0">Runs on</span>
          <div className="h-px flex-1 bg-white/5" />
          {LANGS.map(l => (
            <div key={l.name} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/8 text-sm text-slate-300 hover:border-white/20 transition-colors">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.dot }} />
              {l.name}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 px-8 py-8 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center">
            <Code2 className="w-3 h-3 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-slate-400">CodeSync</span>
        </div>
        <p>Built with Next.js · PostgreSQL · Docker · Socket.io</p>
        <p>Real-time collaborative coding platform</p>
      </footer>
    </div>
  );
}
