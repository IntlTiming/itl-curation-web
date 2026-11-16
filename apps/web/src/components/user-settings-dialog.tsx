import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTitleDisplay, type TitleDisplay } from '@/components/title-display-provider';
import type { AuthUser } from '@/hooks/use-auth';

export function UserSettingsDialog({
  user,
  open,
  onOpenChange,
  onSave,
}: {
  user: AuthUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (displayName: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { titleDisplay: savedTitleDisplay, setTitleDisplay: saveTitleDisplay } = useTitleDisplay();
  const [titleDisplay, setTitleDisplay] = useState<TitleDisplay>(savedTitleDisplay);
  const displayNameId = useId();
  const titleDisplayLabelId = useId();
  const romanizedId = useId();
  const nativeId = useId();

  useEffect(() => {
    if (open) {
      setDisplayName(user.displayName ?? '');
      setTitleDisplay(savedTitleDisplay);
      setError(null);
    }
  }, [open, user.displayName, savedTitleDisplay]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    // Local-only preference - applied before the display-name request so it can't be lost
    // to a failed save.
    saveTitleDisplay(titleDisplay);
    try {
      await onSave(displayName);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>User settings</DialogTitle>
            <DialogDescription>
              Change how your name and song titles appear across ITL Curation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={displayNameId}>Display name</Label>
              <Input
                id={displayNameId}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user.discordUsername}
              />
            </div>
            <div className="grid gap-2">
              <Label id={titleDisplayLabelId}>Song Title Display</Label>
              <RadioGroup
                aria-labelledby={titleDisplayLabelId}
                value={titleDisplay}
                onValueChange={(value) => setTitleDisplay(value as TitleDisplay)}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="romanized" id={romanizedId} />
                  <Label htmlFor={romanizedId} className="font-normal">
                    🔠 Romanized transliteration
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="native" id={nativeId} />
                  <Label htmlFor={nativeId} className="font-normal">
                    ㊗️ Native language
                  </Label>
                </div>
              </RadioGroup>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
