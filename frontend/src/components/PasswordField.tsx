import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function generatePassword(): string {
  return Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-4).toUpperCase();
}

export function PasswordField({
  id,
  value,
  onChange,
  error,
  placeholder = 'Leave blank to auto-generate',
}: {
  id: string;
  value: string | undefined;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Password</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            type={visible ? 'text' : 'password'}
            placeholder={placeholder}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            tabIndex={-1}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange(generatePassword())}>
          Generate
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
