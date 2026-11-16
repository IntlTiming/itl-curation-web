import { useState } from 'react';

export type ImportValidationErrorResponse = { ok: false; errors: string[] };

export type FileImportState<Preview, ApplyResult> =
  | { phase: 'picking' }
  | { phase: 'previewing' }
  | { phase: 'preview-error'; errors: string[] }
  | { phase: 'preview-ready'; file: File; preview: Preview }
  | { phase: 'applying'; file: File }
  | { phase: 'apply-error'; errors: string[] }
  | { phase: 'applied'; result: ApplyResult };

async function postFile<T>(url: string, file: File): Promise<T | ImportValidationErrorResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(url, { method: 'POST', body: form });
  const body = (await res.json().catch(() => null)) as T | ImportValidationErrorResponse | null;
  if (!body) {
    return { ok: false, errors: ["Couldn't reach the server. Try again."] };
  }
  return body;
}

// The pick -> preview -> confirm -> apply state machine shared by the submissions and
// suggestions imports. `baseUrl` is the import endpoint prefix; `${baseUrl}/preview` and
// `${baseUrl}/apply` both take the same uploaded file.
export function useFileImport<
  Preview extends { ok: true },
  ApplyResult,
  Apply extends { ok: true; result: ApplyResult } = { ok: true; result: ApplyResult },
>(baseUrl: string) {
  const [state, setState] = useState<FileImportState<Preview, ApplyResult>>({ phase: 'picking' });
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  async function preview() {
    if (!pendingFile) return;
    const file = pendingFile;
    setState({ phase: 'previewing' });
    const body = await postFile<Preview>(`${baseUrl}/preview`, file);
    if (!body.ok) {
      setState({ phase: 'preview-error', errors: body.errors });
      return;
    }
    setState({ phase: 'preview-ready', file, preview: body });
  }

  async function apply(file: File) {
    setState({ phase: 'applying', file });
    const body = await postFile<Apply>(`${baseUrl}/apply`, file);
    if (!body.ok) {
      setState({ phase: 'apply-error', errors: body.errors });
      return;
    }
    setState({ phase: 'applied', result: body.result });
  }

  function reset() {
    setPendingFile(null);
    setState({ phase: 'picking' });
  }

  return { state, pendingFile, setPendingFile, preview, apply, reset };
}
