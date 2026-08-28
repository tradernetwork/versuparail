import Dashboard from '@/components/Dashboard'

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-retro text-4xl tracking-wide text-[var(--neon-green)] text-glow-green sm:text-5xl">
          OPS DASHBOARD<span className="animate-blink">_</span>
        </h1>
        <p className="font-mono text-xs text-gray-500 sm:text-sm">
          VERCEL // RAILWAY // SUPABASE — cross-provider status for TraderDaddy Pro
        </p>
      </header>
      <Dashboard />
    </main>
  )
}
