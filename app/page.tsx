'use client';

import React, { useState, useEffect } from 'react';

export default function HomePage() {
  const [customers, setCustomers] = useState<File | null>(null);
  const [contracts, setContracts] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function startImport(e: React.FormEvent) {
    e.preventDefault();
    if (!customers) {
      alert('Please choose customers.csv');
      return;
    }

    setLoading(true);
    setStatus('uploading');
    setLogs([]);
    setStats(null);

    const fd = new FormData();
    fd.append('customers', customers);
    if (contracts) {
      fd.append('contracts', contracts);
    }

    try {
      const resp = await fetch('/api/import', {
        method: 'POST',
        body: fd,
      });

      const data = await resp.json();

      if (data.jobId) {
        setJobId(data.jobId);
        setStatus('running');
        pollJob(data.jobId);
      } else {
        alert('Error: ' + (data.error || 'unknown'));
        setStatus('error');
        setLoading(false);
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
      setStatus('error');
      setLoading(false);
    }
  }

  async function pollJob(jid: string) {
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/jobs/${jid}`);
        if (!r.ok) {
          if (r.status === 404) {
            console.error(`Job ${jid} not found`);
            clearInterval(interval);
            setLoading(false);
            setStatus('error');
            return;
          }
          throw new Error(`HTTP ${r.status}`);
        }
        const j = await r.json();

        if (j.logs) {
          setLogs(j.logs);
        }
        if (j.status) {
          setStatus(j.status);
        }
        if (j.stats) {
          setStats(j.stats);
        }

        if (j.status === 'completed' || j.status === 'failed') {
          clearInterval(interval);
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Polling error:', error);
        clearInterval(interval);
        setLoading(false);
      }
    }, 1000);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Zoho CSV Importer</h1>
        <p className="text-sm text-gray-600 mb-6">
          Upload CSV files to import customers and contracts into Zoho CRM. No manual import needed.
        </p>

        <form onSubmit={startImport} className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customers CSV (required)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={e => setCustomers(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contracts CSV (optional)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={e => setContracts(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Processing...' : 'Start Import'}
            </button>
          </div>
        </form>

        {(jobId || status !== 'idle') && (
          <section className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Job Status</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : status === 'running'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {status.toUpperCase()}
                </span>
                {jobId && (
                  <span className="text-sm text-gray-500">Job ID: {jobId}</span>
                )}
              </div>

              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-md">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.contactsCreated}</div>
                    <div className="text-xs text-gray-600">Contacts Created</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.contactsUpdated}</div>
                    <div className="text-xs text-gray-600">Contacts Updated</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.contractsCreated}</div>
                    <div className="text-xs text-gray-600">Contracts Created</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.contractsUpdated}</div>
                    <div className="text-xs text-gray-600">Contracts Updated</div>
                  </div>
                  {stats.errors > 0 && (
                    <div className="col-span-2 md:col-span-4">
                      <div className="text-xl font-bold text-red-600">{stats.errors}</div>
                      <div className="text-xs text-gray-600">Errors</div>
                    </div>
                  )}
                </div>
              )}

              {logs.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Logs</h3>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-md font-mono text-xs max-h-96 overflow-y-auto">
                    {logs.map((l: any, idx: number) => (
                      <div key={idx} className="mb-1">
                        <span className="text-gray-500">
                          [{new Date(l.ts).toLocaleTimeString()}]
                        </span>{' '}
                        <span
                          className={
                            l.level === 'error'
                              ? 'text-red-400'
                              : l.level === 'warn'
                              ? 'text-yellow-400'
                              : 'text-green-400'
                          }
                        >
                          {l.level.toUpperCase()}
                        </span>{' '}
                        — {l.msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

