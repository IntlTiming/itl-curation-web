import { useEffect, useId, useState, type ReactNode, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SLUG_CHECK_DEBOUNCE_MS = 400

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function todayIsoDate() {
  return new Date().toLocaleDateString('en-CA') // en-CA formats as YYYY-MM-DD
}

type SlugCheck = { slug: string; status: 'checking' | 'available' | 'taken' }

export function CreateEventDialog({
  onCreated,
  trigger,
}: {
  onCreated: () => void
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [date, setDate] = useState(todayIsoDate)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugCheck, setSlugCheck] = useState<SlugCheck | null>(null)
  const nameId = useId()
  const slugId = useId()
  const dateId = useId()

  const isValidSlugFormat = SLUG_PATTERN.test(slug)

  useEffect(() => {
    if (!isValidSlugFormat) return
    let cancelled = false
    const timeout = setTimeout(() => {
      setSlugCheck({ slug, status: 'checking' })
      fetch(`/api/events/check-slug?slug=${encodeURIComponent(slug)}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ available: boolean }>) : Promise.reject()))
        .then(({ available }) => {
          if (!cancelled) setSlugCheck({ slug, status: available ? 'available' : 'taken' })
        })
        .catch(() => {
          if (!cancelled) setSlugCheck(null)
        })
    }, SLUG_CHECK_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [slug, isValidSlugFormat])

  const slugStatus = slugCheck?.slug === slug ? slugCheck.status : null
  const slugVerifiedAvailable = isValidSlugFormat && slugStatus === 'available'

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  function reset() {
    setName('')
    setSlug('')
    setSlugTouched(false)
    setDate(todayIsoDate())
    setError(null)
    setSlugCheck(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, date: date || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        if (res.status === 409) {
          setSlugCheck({ slug, status: 'taken' })
          return
        }
        throw new Error(body?.message ?? 'Failed to create event')
      }
      reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create event</DialogTitle>
            <DialogDescription>Add a new ITL Online season.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={nameId}>Name</Label>
              <Input
                id={nameId}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={slugId}>Slug</Label>
              <Input
                id={slugId}
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value)
                }}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                aria-invalid={slugStatus === 'taken'}
                required
              />
              <div className="min-h-5">
                {slugStatus === 'checking' && (
                  <p className="text-sm text-muted-foreground">Checking availability…</p>
                )}
                {slugStatus === 'taken' && (
                  <p className="text-sm text-destructive">An event with slug "{slug}" already exists</p>
                )}
                {slugStatus === 'available' && (
                  <p className="text-sm text-green-600 dark:text-green-500">
                    The slug "{slug}" is available.
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={dateId}>Date (optional)</Label>
              <Input id={dateId} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !slugVerifiedAvailable}>
              {submitting ? 'Creating…' : 'Create event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
