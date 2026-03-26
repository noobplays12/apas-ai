import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as XLSX from 'xlsx';
import { getSupabaseAdmin, getAuthedUserAndRole } from '../_supabaseAdmin.js';
import { ensureStudentLogins } from '../lib/studentAuthSync.js';

type ParsedRow = { full_name: string; roll_no: string };

function normalizeHeader(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ''); // remove spaces/underscores/etc
}

function looksLikeRollToken(t: string): boolean {
  const s = t.trim().toUpperCase();
  if (s.length < 3) return false;
  if (!/\d/.test(s)) return false;
  return /^[A-Z0-9\-]+$/.test(s);
}

function parseBase64Payload(input: string): Buffer {
  // Accept both raw base64 and data URLs like: data:...;base64,XXXX
  const clean = String(input ?? '').trim();
  const b64 = clean.includes(',') ? clean.slice(clean.indexOf(',') + 1) : clean;
  return Buffer.from(b64, 'base64');
}

function parseCsvTwoCol(text: string): ParsedRow[] {
  // CSV must be simple (no commas inside Name). Recommended: use XLSX instead.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  const headerNorm = header.map(normalizeHeader);

  const rollIdx = headerNorm.findIndex((h) => ['rollno', 'rollno.', 'rollno', 'roll', 'rollno'].includes(h) || h === 'rollno');
  const nameIdx = headerNorm.findIndex((h) => h === 'name' || h === 'fullname' || h === 'studentname');

  // Fallback: assume 1st col = roll, 2nd col = name
  const effectiveRollIdx = rollIdx >= 0 ? rollIdx : 0;
  const effectiveNameIdx = nameIdx >= 0 ? nameIdx : 1;

  const out: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(','); // simplistic CSV parsing
    const rawRoll = cols[effectiveRollIdx] ?? '';
    const rawName = cols[effectiveNameIdx] ?? '';
    const roll_no = String(rawRoll).trim().toUpperCase();
    const full_name = String(rawName).trim().replace(/\s+/g, ' ');
    if (!roll_no || !full_name) continue;
    if (!looksLikeRollToken(roll_no)) continue;
    out.push({ full_name, roll_no });
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { role } = await getAuthedUserAndRole(req);
    if (role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const supabase = getSupabaseAdmin();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const fileBase64: string | undefined = body?.fileBase64 ?? body?.pdfBase64;
    const fileName: string = String(body?.fileName ?? body?.name ?? '');
    const semesterId: string | undefined = body?.semesterId;
    const sectionId: string | undefined = body?.sectionId;

    if (!fileBase64 || !sectionId) {
      return res.status(400).json({ error: 'Missing fileBase64 or sectionId' });
    }

    const buf = parseBase64Payload(fileBase64);
    if (!buf.length) {
      return res.status(400).json({ error: 'Invalid file payload (empty after base64 decode).' });
    }
    if (buf.length > 6 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (max ~6MB)' });
    }

    const lowerName = fileName.toLowerCase();
    let rows: ParsedRow[] = [];
    if (lowerName.endsWith('.csv')) {
      rows = parseCsvTwoCol(buf.toString('utf8'));
    } else {
      const wb = XLSX.read(buf, { type: 'buffer' });
      const firstSheetName = wb.SheetNames?.[0];
      const sheet = firstSheetName ? wb.Sheets[firstSheetName] : undefined;
      if (!sheet) {
        return res.status(400).json({ error: 'Excel file has no readable worksheet.' });
      }
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (!data.length) {
        return res.status(200).json({ ok: true, inserted: 0, skipped: 0, totalParsed: 0, warnings: ['Sheet is empty.'] });
      }

      // Detect columns from the first row keys
      const keys = Object.keys(data[0] ?? {});
      const rollAliases = new Set(['rollno', 'rollnumber', 'roll', 'regno', 'registrationno']);
      const nameAliases = new Set(['name', 'fullname', 'studentname']);
      const rollKey = keys.find((k) => rollAliases.has(normalizeHeader(k)));
      const nameKey = keys.find((k) => {
        return nameAliases.has(normalizeHeader(k));
      });

      if (!rollKey || !nameKey) {
        return res.status(400).json({
          error: `Could not find required columns in Excel. Need roll number column and name column. Found headers: ${keys.join(', ')}`,
        });
      }

      for (const r of data) {
        const roll_no = String(r[rollKey] ?? '').trim().toUpperCase();
        const full_name = String(r[nameKey] ?? '').trim().replace(/\s+/g, ' ');
        if (!roll_no || !full_name) continue;
        if (!looksLikeRollToken(roll_no)) continue;
        rows.push({ roll_no, full_name });
      }
    }

    if (rows.length === 0) {
      await supabase.from('import_logs').insert({
        kind: 'section_pdf',
        message: 'No valid rows parsed from Excel/CSV',
        meta: { sectionId, semesterId: semesterId ?? null, fileName, count: 0 },
      }).then(() => undefined);
      return res.status(200).json({
        ok: true,
        inserted: 0,
        skipped: 0,
        totalParsed: 0,
        warnings: [
          'No rows matched. Use headers: `Roll No` and `Name` (example row: F25BARIN1M01052, PARI GULL).',
        ],
      });
    }

    // Deduplicate
    const dedup = new Map<string, ParsedRow>();
    for (const r of rows) {
      const k = r.roll_no;
      if (!dedup.has(k)) dedup.set(k, r);
    }
    const finalRows = [...dedup.values()];

    const { error: upsertErr } = await supabase.from('section_students').upsert(
      finalRows.map((r) => ({
        section_id: sectionId,
        roll_no: r.roll_no,
        full_name: r.full_name,
      })),
      { onConflict: 'section_id,roll_no' }
    );
    if (upsertErr) throw upsertErr;

    await supabase.from('import_logs').insert({
      kind: 'section_pdf',
      message: `Upserted ${finalRows.length} section students (Excel/CSV)`,
      meta: { semesterId: semesterId ?? null, sectionId, parsed: finalRows.length },
    }).then(() => undefined);

    const syncResult = await ensureStudentLogins(
      supabase as any,
      finalRows.map((r) => ({ roll_no: r.roll_no, full_name: r.full_name, section_id: sectionId })),
      semesterId ?? null
    );

    return res.status(200).json({
      ok: true,
      inserted: finalRows.length,
      skipped: 0,
      totalParsed: rows.length,
      warnings: syncResult.failed ? [`Failed to create ${syncResult.failed} student login(s).`] : [],
      loginSync: syncResult,
    });
  } catch (e: any) {
    console.error('parse-section-excel (handler failed)', e);
    return res.status(500).json({ error: e?.message ?? 'Parse failed' });
  }
}

