import 'server-only';

export async function getLastPush(repoUrl: string | null | undefined): Promise<string | null> {
  if (!repoUrl) return null;
  const match = repoUrl.match(/github\.com\/([^/?#]+\/[^/?#]+)/);
  if (!match) return null;
  const repo = match[1].replace(/\.git$/, '');

  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json() as { pushed_at?: string };
    return data.pushed_at ?? null;
  } catch {
    return null;
  }
}

export function formatPush(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem.`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
