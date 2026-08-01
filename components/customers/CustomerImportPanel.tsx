'use client';

import { useMemo, useState, type DragEvent } from 'react';
import {
  CUSTOMER_IMPORT_TEMPLATE_CSV,
  IMPORT_BATCH_SIZE,
  decodeCsvBytes,
  isLikelyCsvFile,
  parseCustomerCsv,
  type ParsedImportRow,
} from '@/lib/customers/csv-import';
import {
  deleteJunkCustomers,
  importCustomerBatch,
  wipeCustomersWithoutJobs,
  type CleanupResult,
  type DuplicateMode,
  type ImportBatchRow,
  type ImportCustomersResult,
} from '@/app/dashboard/customers/import/actions';
import { cn } from '@/lib/utils';

function downloadTemplate() {
  const blob = new Blob([CUSTOMER_IMPORT_TEMPLATE_CSV], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'easydispatch-customers-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

type Progress = {
  done: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

export function CustomerImportPanel() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('skip');
  const [result, setResult] = useState<ImportCustomersResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(
    null
  );

  const preview = useMemo(() => {
    if (!csvText.trim()) return null;
    try {
      return parseCustomerCsv(csvText);
    } catch {
      return {
        rows: [] as ParsedImportRow[],
        mapping: {},
        headers: [] as string[],
        error: 'Could not parse that CSV. Try Save As → CSV UTF-8 from Excel.',
      };
    }
  }, [csvText]);

  const validRows = preview?.rows.filter((r) => r.data) ?? [];
  const invalidRows = preview?.rows.filter((r) => !r.data) ?? [];
  const junkSkipped =
    invalidRows.filter((r) =>
      (r.error || '').toLowerCase().includes('skipped:')
    ).length ?? 0;
  const largeFile = csvText.length > 40_000;
  const isHousecall = preview?.format === 'housecall_pro';

  async function loadFile(file: File | null) {
    setResult(null);
    setParseError(null);
    setProgress(null);
    if (!file) {
      setCsvText('');
      setFileName('');
      return;
    }

    if (/\.(xlsx|xls)$/i.test(file.name)) {
      setParseError(
        'Excel workbook (.xlsx) isn’t supported yet. In Excel: File → Save As → CSV UTF-8 (.csv), then upload that file.'
      );
      return;
    }

    if (!isLikelyCsvFile(file)) {
      setParseError(
        'Please upload a .csv file (or Save As → CSV UTF-8 from Excel).'
      );
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const text = decodeCsvBytes(buffer);
      if (!text.trim()) {
        setParseError('That file looks empty.');
        return;
      }
      setFileName(file.name);
      setCsvText(text);
      setShowPaste(false);
    } catch {
      setParseError('Could not read that file. Try Save As → CSV UTF-8.');
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    void loadFile(file);
  }

  async function runImport() {
    if (!validRows.length || pending) return;
    setResult(null);
    setPending(true);

    const batches: ImportBatchRow[][] = [];
    for (let i = 0; i < validRows.length; i += IMPORT_BATCH_SIZE) {
      batches.push(
        validRows.slice(i, i + IMPORT_BATCH_SIZE).map((r) => ({
          ...r.data!,
          line: r.line,
        }))
      );
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = invalidRows.length;
    const errors: { line: number; message: string }[] = invalidRows
      .slice(0, 20)
      .map((r) => ({
        line: r.line,
        message: r.error || 'Invalid',
      }));
    const skippedSamples: { line: number; name: string; reason: string }[] =
      [];

    setProgress({
      done: 0,
      total: validRows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed,
    });

    try {
      for (let b = 0; b < batches.length; b++) {
        const finalize = b === batches.length - 1;
        const res = await importCustomerBatch(batches[b], duplicateMode, {
          finalize,
        });

        if (res.error) {
          setResult({
            error: `Stopped at batch ${b + 1}/${batches.length}: ${res.error}. Imported so far: ${created} created, ${updated} updated, ${skipped} skipped.`,
            created,
            updated,
            skipped,
            failed,
            errors,
          });
          setPending(false);
          return;
        }

        created += res.created || 0;
        updated += res.updated || 0;
        skipped += res.skipped || 0;
        failed += res.failed || 0;
        if (res.errors?.length) {
          for (const e of res.errors) {
            if (errors.length < 40) errors.push(e);
          }
        }
        if (res.skippedSamples?.length) {
          for (const s of res.skippedSamples) {
            if (skippedSamples.length < 40) skippedSamples.push(s);
          }
        }

        setProgress({
          done: Math.min((b + 1) * IMPORT_BATCH_SIZE, validRows.length),
          total: validRows.length,
          created,
          updated,
          skipped,
          failed,
        });
      }

      setResult({
        success: `Import finished: ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed`,
        created,
        updated,
        skipped,
        failed,
        errors,
        skippedSamples,
      });
    } catch (err) {
      setResult({
        error:
          err instanceof Error
            ? `Import interrupted: ${err.message}. Progress: ${created} created so far — you can run import again with “Skip duplicates”.`
            : `Import interrupted. Progress: ${created} created so far — run again with “Skip duplicates”.`,
        created,
        updated,
        skipped,
        failed,
        errors,
        skippedSamples,
      });
    } finally {
      setPending(false);
    }
  }

  const pct =
    progress && progress.total
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  async function runJunkCleanup() {
    if (cleanupPending || pending) return;
    const ok = window.confirm(
      'Remove junk/false customers (names that are only phone numbers or digits)? This cannot be undone.'
    );
    if (!ok) return;
    setCleanupPending(true);
    setCleanupResult(null);
    try {
      setCleanupResult(await deleteJunkCustomers());
    } catch (err) {
      setCleanupResult({
        error: err instanceof Error ? err.message : 'Cleanup failed',
      });
    } finally {
      setCleanupPending(false);
    }
  }

  async function runWipeForReplace() {
    if (cleanupPending || pending) return;
    const ok = window.confirm(
      'Delete ALL customers that do not have jobs, then you can re-import your CSV cleanly?\n\nCustomers with jobs are kept. This cannot be undone.'
    );
    if (!ok) return;
    const ok2 = window.confirm(
      'Last check: wipe the customer list (except ones with jobs)?'
    );
    if (!ok2) return;
    setCleanupPending(true);
    setCleanupResult(null);
    try {
      setCleanupResult(await wipeCustomersWithoutJobs());
    } catch (err) {
      setCleanupResult({
        error: err instanceof Error ? err.message : 'Wipe failed',
      });
    } finally {
      setCleanupPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="panel space-y-4 border-amber-200 bg-amber-50/40 p-5">
        <div>
          <h2 className="text-base font-semibold text-ink-900">
            Clean up a bad import
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            “Update matching” only edits existing rows — it never deletes junk.
            Use one of these first, then import the CSV again.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={cleanupPending || pending}
            onClick={() => void runJunkCleanup()}
            className="rounded-lg bg-ink-900 px-3 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {cleanupPending ? 'Working…' : 'Remove junk/false customers'}
          </button>
          <button
            type="button"
            disabled={cleanupPending || pending}
            onClick={() => void runWipeForReplace()}
            className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
          >
            Wipe list & prepare re-import
          </button>
        </div>
        <p className="text-xs text-ink-500">
          Wipe removes every customer with no jobs (safe for a fresh migration).
          Anything with a job stays linked.
        </p>
        {cleanupResult && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              cleanupResult.error
                ? 'bg-red-50 text-red-700'
                : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {cleanupResult.error || cleanupResult.success}
          </p>
        )}
      </div>

      <div className="panel space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-ink-900">
            Import from CSV
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Works with Housecall Pro customer exports and standard CSVs. Large
            lists import in batches. Junk rows (names that are only phone
            numbers) are skipped automatically.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'rounded-xl border-2 border-dashed px-4 py-8 text-center transition',
            dragOver
              ? 'border-brand-500 bg-brand-50'
              : 'border-ink-200 bg-ink-50/40'
          )}
        >
          <p className="text-sm font-medium text-ink-800">
            Drop your .csv file here
          </p>
          <p className="mt-1 text-xs text-ink-500">or</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              Download template
            </button>
            <label className="cursor-pointer rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Choose CSV file
              <input
                type="file"
                accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => void loadFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {fileName && (
            <p className="mt-3 text-sm text-ink-600">
              Loaded: <span className="font-medium">{fileName}</span>
              {preview && !preview.error ? (
                <span className="text-ink-400">
                  {' '}
                  · {validRows.length.toLocaleString()} ready
                </span>
              ) : null}
            </p>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowPaste((v) => !v)}
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            {showPaste ? 'Hide paste box' : 'Or paste CSV text'}
          </button>
          {showPaste && (
            <textarea
              value={largeFile ? '' : csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setFileName(e.target.value.trim() ? 'pasted.csv' : '');
                setParseError(null);
                setResult(null);
                setProgress(null);
              }}
              rows={4}
              placeholder={
                largeFile
                  ? 'Large file already loaded from disk — clear and paste here to replace.'
                  : 'name,address,city,state,zip,phone,email\nAcme Fitness,123 Main,…'
              }
              className="mt-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-xs outline-none ring-brand-500/30 focus:ring-4"
            />
          )}
        </div>

        <label className="block max-w-md">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">
            If a customer already exists
          </span>
          <select
            value={duplicateMode}
            onChange={(e) => setDuplicateMode(e.target.value as DuplicateMode)}
            disabled={pending}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4 disabled:opacity-60"
          >
            <option value="skip">Skip duplicates (recommended)</option>
            <option value="update">Update matching customers</option>
            <option value="create">Create anyway (may duplicate)</option>
          </select>
          <p className="mt-1 text-xs text-ink-400">
            Match by phone, or same name + address. Shared emails (like a shop
            invoice inbox on many accounts) no longer collapse different
            customers. Safe to re-run after a partial import.
          </p>
        </label>

        {parseError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {parseError}
          </p>
        )}
        {preview?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {preview.error}
          </p>
        )}
      </div>

      {preview && !preview.error && (
        <div className="panel space-y-3 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Preview</h2>
              <p className="mt-1 text-sm text-ink-500">
                {isHousecall ? 'Housecall Pro export detected · ' : ''}
                {validRows.length.toLocaleString()} ready ·{' '}
                {junkSkipped.toLocaleString()} skipped junk ·{' '}
                {(invalidRows.length - junkSkipped).toLocaleString()} other
                errors
                {validRows.length > IMPORT_BATCH_SIZE
                  ? ` · ${Math.ceil(validRows.length / IMPORT_BATCH_SIZE)} batches`
                  : ''}
              </p>
            </div>
            <button
              type="button"
              disabled={pending || !validRows.length}
              onClick={() => void runImport()}
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending
                ? `Importing… ${pct}%`
                : `Import ${validRows.length.toLocaleString()} customers`}
            </button>
          </div>

          {progress && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-ink-500">
                {progress.done.toLocaleString()} /{' '}
                {progress.total.toLocaleString()} · {progress.created} created ·{' '}
                {progress.updated} updated · {progress.skipped} skipped
              </p>
            </div>
          )}

          <PreviewTable rows={preview.rows.slice(0, 25)} />
          {preview.rows.length > 25 && (
            <p className="text-xs text-ink-400">
              Showing first 25 of {preview.rows.length.toLocaleString()} rows.
              All valid rows will import.
            </p>
          )}
        </div>
      )}

      {result && (
        <div
          className={`panel space-y-2 p-5 ${
            result.error
              ? 'border-red-200 bg-red-50/40'
              : 'border-emerald-200 bg-emerald-50/40'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              result.error ? 'text-red-800' : 'text-emerald-900'
            }`}
          >
            {result.error || result.success}
          </p>
          {result.errors && result.errors.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-ink-600">
              {result.errors.map((e) => (
                <li key={`${e.line}-${e.message}`}>
                  Line {e.line}: {e.message}
                </li>
              ))}
            </ul>
          )}
          {result.skippedSamples && result.skippedSamples.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-ink-700">
                Sample skipped as duplicates:
              </p>
              <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-ink-600">
                {result.skippedSamples.map((s) => (
                  <li key={`${s.line}-${s.reason}`}>
                    Line {s.line} ({s.name}): {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!result.error && (
            <a
              href="/dashboard/customers"
              className="inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              View customers →
            </a>
          )}
        </div>
      )}

      <div className="panel space-y-2 p-5 text-sm text-ink-600">
        <h2 className="text-base font-semibold text-ink-900">
          Tips for migrating
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Housecall Pro: uses Display Name, mobile/home/work phone, email,
            notes, and all Address_1… sites (city/state/zip pulled from line 2
            when needed).
          </li>
          <li>
            Rows whose name is only a phone number / digits are skipped (~400 in
            a typical messy export).
          </li>
          <li>
            “Do Not Service” customers are skipped.
          </li>
          <li>
            Duplicate matching uses phone or name + address. The same email on
            different company names (common with a shop invoice inbox) will
            import as separate customers.
          </li>
          <li>
            After a messy first import: use{' '}
            <strong>Remove junk/false customers</strong> or{' '}
            <strong>Wipe list & prepare re-import</strong>, then import again
            with Skip duplicates or Update matching.
          </li>
        </ul>
      </div>
    </div>
  );
}

function PreviewTable({ rows }: { rows: ParsedImportRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-100">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-3 py-2 font-medium">Line</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">City</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Phone</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => (
            <tr key={r.line}>
              <td className="px-3 py-2 text-ink-400">{r.line}</td>
              <td className="px-3 py-2 font-medium text-ink-900">
                {r.data?.name || r.raw.name || r.raw.Name || '—'}
              </td>
              <td className="hidden px-3 py-2 text-ink-600 sm:table-cell">
                {r.data?.city || '—'}
              </td>
              <td className="hidden px-3 py-2 text-ink-600 md:table-cell">
                {r.data?.phone || '—'}
              </td>
              <td className="px-3 py-2">
                {r.data ? (
                  <span className="text-emerald-700">Ready</span>
                ) : (r.error || '').startsWith('Skipped:') ? (
                  <span className="text-amber-700">{r.error}</span>
                ) : (
                  <span className="text-red-600">{r.error || 'Error'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
