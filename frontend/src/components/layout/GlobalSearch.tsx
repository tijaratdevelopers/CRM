import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

export function GlobalSearch() {
  const [value, setValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    navigate(`/leads?search=${encodeURIComponent(value.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative mx-auto hidden w-full max-w-xl sm:block">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        placeholder="Search leads by name, phone, email…"
        className="h-10 w-full rounded-full border border-border bg-secondary/60 pl-10 pr-14 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:bg-secondary"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:flex">
        ⌘K
      </kbd>
    </form>
  );
}
