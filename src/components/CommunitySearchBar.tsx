import type React from 'react';
import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
}

export default function CommunitySearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search discussions…',
}: Props) {
  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-xs">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </form>
  );
}
