// Toggles a submission's membership in the selected set (by fileId - see SubmissionSelection's
// schema comment). Shared by the Reviews table's Selected column and the submission detail
// page's checkbox. Resolves to the server's resulting state; rejects with a user-facing message.
export async function setSubmissionSelected(
  eventSlug: string,
  fileId: string,
  selected: boolean,
): Promise<{ selected: boolean }> {
  const res = await fetch(
    `/api/events/${encodeURIComponent(eventSlug)}/selections/${encodeURIComponent(fileId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Couldn't ${selected ? 'select' : 'unselect'} this chart`);
  }
  return res.json();
}
