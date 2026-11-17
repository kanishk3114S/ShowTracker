import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { checkApiHealth } from '../../services/api';
import { 
  Server, 
  Database, 
  Radio, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  Terminal, 
  ShieldCheck,
  Film,
  ArrowLeft
} from 'lucide-react';

export default function Health() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    const result = await checkApiHealth();
    if (result.ok) {
      setHealthData(result.data);
    } else {
      setError(result.error);
      setHealthData(null);
    }
    setLastChecked(new Date().toLocaleTimeString());
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const isServerHealthy = Boolean(healthData && healthData.services?.server?.status === 'healthy');
  const isDbConnected = Boolean(healthData && healthData.services?.database?.status === 'connected');

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6] flex flex-col font-sans selection:bg-red-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-[#2A3245] bg-[#151922]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              to="/"
              className="w-9 h-9 rounded-xl bg-[#1C2230] hover:bg-[#2A3245] border border-[#2A3245] flex items-center justify-center text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-[#F2B33D] flex items-center justify-center">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white">ShowTracker</span>
                <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-red-950/70 border border-red-800/60 text-red-400">
                  System Health
                </span>
              </div>
              <p className="text-xs text-[#9CA3AF]">Foundation architecture & PostgreSQL diagnostics</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs text-[#9CA3AF]">
              <Clock className="w-3.5 h-3.5" />
              <span>Last checked: {lastChecked || 'Checking...'}</span>
            </div>
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#1C2230] hover:bg-[#2A3245] border border-[#2A3245] text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red-400' : ''}`} />
              <span>{loading ? 'Testing...' : 'Refresh Health'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
        
        {/* Status Hero Banner */}
        <section className="bg-[#111113] border border-[#2A2A30] rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center space-x-2 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Architecture & Connectivity Diagnostics</span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              System Architecture & Health Verification
            </h1>
            
            <p className="text-sm md:text-base text-[#9CA3AF] max-w-3xl leading-relaxed">
              Verifying the full connection chain: React Client &rarr; Express Backend API &rarr; PostgreSQL Database (<code className="text-red-400 bg-[#0B0E14] px-1.5 py-0.5 rounded font-mono text-xs">SELECT NOW()</code>).
            </p>
          </div>
        </section>

        {/* System Nodes Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Node 1: React Frontend */}
          <div className="bg-[#151922] border border-[#2A3245] rounded-2xl p-6 space-y-4 hover:border-[#3B455E] transition-all">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#F2B33D]">
                <Radio className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>Running</span>
              </span>
            </div>
            
            <div>
              <h3 className="font-bold text-white text-base">React + Vite Client</h3>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Frontend Single Page Application</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#2A3245] text-xs">
              <div className="flex justify-between py-1">
                <span className="text-[#9CA3AF]">Framework:</span>
                <span className="font-mono text-white">React 19 + Vite</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#9CA3AF]">Language:</span>
                <span className="font-mono text-white">JavaScript (ESM)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#9CA3AF]">API Base:</span>
                <span className="font-mono text-red-400 truncate max-w-[140px]">
                  {import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}
                </span>
              </div>
            </div>
          </div>

          {/* Node 2: Express Backend */}
          <div className="bg-[#151922] border border-[#2A3245] rounded-2xl p-6 space-y-4 hover:border-[#3B455E] transition-all">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#F2B33D]">
                <Server className="w-5 h-5" />
              </div>
              {loading ? (
                <span className="inline-flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[#1C2230] border border-[#2A3245] text-[#9CA3AF]">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Checking...</span>
                </span>
              ) : isServerHealthy ? (
                <span className="inline-flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Healthy</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-950/80 border border-red-800/60 text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  <span>Unreachable</span>
                </span>
              )}
            </div>
            
            <div>
              <h3 className="font-bold text-white text-base">Express Backend API</h3>
              <p className="text-xs text-[#9CA3AF] mt-0.5">REST API, Security & Business Logic</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#2A3245] text-xs">
              <div className="flex justify-between py-1">
                <span className="text-[#9CA3AF]">Server Runtime:</span>
                <span className="font-mono text-white">
                  {healthData?.services?.server?.nodeVersion || 'Node.js 22'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#9CA3AF]">Environment:</span>
                <span className="font-mono text-white">{healthData?.environment || 'unknown'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#9CA3AF]">Status:</span>
                <span className={`font-mono ${isServerHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isServerHealthy ? 'HTTP 200 OK' : 'Checking...'}
                </span>
              </div>
            </div>
          </div>

          {/* Node 3: PostgreSQL Database */}
          <div className="bg-[#151922] border border-[#2A3245] rounded-2xl p-6 space-y-4 hover:border-[#3B455E] transition-all">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#F2B33D]">
                <Database className="w-5 h-5" />
              </div>
              {loading ? (
                <span className="inline-flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[#1C2230] border border-[#2A3245] text-[#9CA3AF]">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Checking...</span>
                </span>
              ) : isDbConnected ? (
                <span className="inline-flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-800/60 text-amber-400">
                  <AlertCircle className="w-3 h-3" />
                  <span>Connection Required</span>
                </span>
              )}
            </div>
            
            <div>
              <h3 className="font-bold text-white text-base">PostgreSQL Database</h3>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Supabase PostgreSQL Store</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#2A3245] text-xs">
              <div className="flex justify-between py-1">
                <span className="text-[#9CA3AF]">Engine:</span>
                <span className="font-mono text-white">PostgreSQL</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#9CA3AF]">Connected User:</span>
                <span className="font-mono text-white">
                  {healthData?.services?.database?.connectedAs || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#9CA3AF]">Active Schema:</span>
                <span className="font-mono text-white">
                  {healthData?.services?.database?.schema || 'public'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Database Diagnostic Notice if disconnected */}
        {!isDbConnected && (
          <section className="bg-amber-950/20 border border-amber-800/40 rounded-2xl p-6 space-y-3">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-300">
                  PostgreSQL Session Pooler Required for IPv4 Networks
                </h4>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  {healthData?.services?.database?.error || error || 'PostgreSQL connection could not be established.'}
                </p>
                <p className="text-xs text-[#9CA3AF] pt-1">
                  In Supabase Dashboard &rarr; <strong>Connect</strong>, copy the <strong>Session Pooler URI</strong> (which resolves over IPv4 on port 5432) and update DATABASE_URL in server/.env.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Live SELECT NOW() Result if connected */}
        {isDbConnected && healthData?.services?.database?.serverTime && (
          <section className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-6 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h4 className="text-sm font-bold text-emerald-300">Live PostgreSQL Verification Successful!</h4>
            </div>
            <p className="text-xs text-emerald-200/80">
              Express executed <code className="bg-[#0B0E14] px-1.5 py-0.5 rounded font-mono text-emerald-300">SELECT NOW() AS current_time</code> against Supabase PostgreSQL.
            </p>
            <div className="bg-[#0B0E14] p-3 rounded-lg border border-[#2A3245] font-mono text-xs text-emerald-400">
              Server Time: {healthData.services.database.serverTime}
            </div>
          </section>
        )}

        {/* Collapsible Raw JSON Response */}
        <section className="bg-[#151922] border border-[#2A3245] rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#1C2230] transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-red-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Inspect Raw API Health Response (GET /api/health)
              </span>
            </div>
            <span className="text-xs text-[#9CA3AF] font-mono">
              {showRawJson ? 'Hide ▲' : 'Show ▼'}
            </span>
          </button>
          
          {showRawJson && (
            <div className="p-4 border-t border-[#2A3245] bg-[#0B0E14]">
              <pre className="text-xs font-mono text-red-300 overflow-x-auto p-4 rounded-lg bg-[#151922] border border-[#2A3245]">
                {JSON.stringify(healthData || { error }, null, 2)}
              </pre>
            </div>
          )}
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A3245] bg-[#151922] py-4 px-6 text-center text-xs text-[#9CA3AF]">
        <span>ShowTracker &bull; Engineering Health Check &bull; <Link to="/" className="underline hover:text-white">Return to Application</Link></span>
      </footer>
    </div>
  );
}
