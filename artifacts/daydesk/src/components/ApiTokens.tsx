import { useState, useEffect, useCallback } from 'react';
import { Plus, Copy, Check, Trash2, Key, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiToken {
  id: string;
  name: string;
  scopes: string;
  created_at: string;
  last_used_at: string | null;
}

interface CreatedToken extends ApiToken {
  token: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function scopeLabel(scopes: string): string {
  return scopes.includes('write') ? 'read + write' : 'read only';
}

function scopeBadgeClass(scopes: string): string {
  return scopes.includes('write')
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
}

// ─── One-time token reveal ────────────────────────────────────────────────────

function TokenReveal({ token, onDone }: { token: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-3">
      <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p className="text-sm font-medium">Copy your token — it won't be shown again.</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 font-mono text-xs bg-background border border-border rounded-lg px-3 py-2 overflow-x-auto break-all">
          {visible ? token : '•'.repeat(Math.min(token.length, 40))}
        </div>
        <button
          onClick={() => setVisible((v) => !v)}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          title={visible ? 'Hide token' : 'Reveal token'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button
          onClick={copy}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Use as{' '}
        <code className="font-mono bg-muted px-1 rounded">
          Authorization: Bearer &lt;token&gt;
        </code>{' '}
        in your HTTP requests.
      </p>

      <Button variant="outline" size="sm" onClick={onDone} className="w-full">
        Done
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ApiTokensProps {
  open: boolean;
  onClose: () => void;
}

export function ApiTokens({ open, onClose }: ApiTokensProps) {
  const [tokens, setTokens]     = useState<ApiToken[]>([]);
  const [loading, setLoading]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newScope, setNewScope] = useState<'read' | 'read,write'>('read,write');
  const [revealed, setRevealed] = useState<CreatedToken | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Session cookie is sent automatically by the browser (HttpOnly, SameSite=Strict).
      const res = await fetch('/api/tokens', { credentials: 'include' });
      if (res.ok) {
        setTokens(await res.json());
      } else {
        setError('Could not load tokens — try refreshing the page.');
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), scopes: newScope }),
      });
      if (res.ok) {
        const created: CreatedToken = await res.json();
        setRevealed(created);
        setNewName('');
        setNewScope('read,write');
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try {
      await fetch(`/api/tokens/${id}`, { method: 'DELETE', credentials: 'include' });
      setTokens((prev) => prev.filter((t) => t.id !== id));
      if (revealed?.id === id) setRevealed(null);
    } finally {
      setRevoking(null);
    }
  };

  const [urlCopied, setUrlCopied] = useState(false);
  const chatUrl = `${window.location.origin}/api/chat`;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(chatUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Access
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          {revealed && (
            <TokenReveal token={revealed.token} onDone={() => setRevealed(null)} />
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium">New token</p>
            <Input
              placeholder="Token name  (e.g. Apple Shortcuts)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground shrink-0">Scope:</span>
              <div className="flex gap-2">
                {(['read,write', 'read'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setNewScope(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      newScope === s
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s === 'read,write' ? 'read + write' : 'read only'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {newScope === 'read,write'
                ? 'Can send messages to the AI and read cards — use for Shortcuts or agents.'
                : 'Can only read cards — safe for dashboards or passive monitors.'}
            </p>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              size="sm"
              className="w-full"
            >
              {creating ? 'Creating…' : <><Plus className="h-4 w-4 mr-1.5" />Generate token</>}
            </Button>
          </div>

          {tokens.length > 0 && (
            <>
              <hr className="border-border" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Active tokens</p>
                {tokens.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{t.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scopeBadgeClass(t.scopes)}`}>
                          {scopeLabel(t.scopes)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created {fmt(t.created_at)}
                        {t.last_used_at ? ` · Last used ${fmt(t.last_used_at)}` : ' · Never used'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(t.id)}
                      disabled={revoking === t.id}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      title="Revoke token"
                    >
                      {revoking === t.id ? <span className="text-xs">…</span> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && tokens.length === 0 && !revealed && !error && (
            <p className="text-sm text-muted-foreground text-center py-2">No tokens yet.</p>
          )}

          <div className="rounded-xl bg-muted/50 px-3 py-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">Apple Shortcuts example</p>
            <div className="flex items-center gap-2">
              <span className="shrink-0">POST</span>
              <code className="flex-1 font-mono bg-background border border-border rounded px-2 py-1 overflow-x-auto break-all">
                {chatUrl}
              </code>
              <button
                onClick={copyUrl}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Copy URL"
              >
                {urlCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p>Body (JSON):</p>
            <code className="block font-mono bg-background border border-border rounded px-2 py-1 overflow-x-auto break-all">
              {`{"message": "remind me to call John at 3pm"}`}
            </code>
            <p>Header:</p>
            <code className="block font-mono bg-background border border-border rounded px-2 py-1 overflow-x-auto break-all">
              Authorization: Bearer &lt;token&gt;
            </code>
            <p className="pt-0.5 text-muted-foreground/70">
              The AI handles everything — card type, bucket, details — just like typing in the app.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
