import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, getAuthedUserAndRole } from '../_supabaseAdmin';
import { extractPdfText } from '../lib/extractPdfText';

type ParsedRow = { full_name: string; roll_no: string };

/** University roll numbers e.g. F25BARIN1M01052 — letter + digits + alphanumeric */
function looksLikeRollToken(t: string): boolean {
  const s = t.trim().toUpperCase();
  if (s.length < 10 || s.length > 32) return false;
  if (!/^[A-Z]/.test(s)) return false;
  if (!/\d/.test(s)) return false;
  return /^[A-Z0-9\-]+$/.test(s);
}

function parseStudentLines(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ParsedRow[] = [];
  const seen = new Set<string>();

  for (let line of lines) {
    // Skip obvious headers / footer noise
    if (/^(sr\.?|roll\s*no|name|signature|date|attendance|department|islamia|section|semester|page\s*\d)/i.test(line)) {
      continue;
    }

    // Normalize spaces
    line = line.replace(/\s+/g, ' ').trim();

    // Pattern A: optional Sr, then ROLL (token), then NAME (rest)
    // e.g. "1 F25BARIN1M01052 PARI GULL" or "1 F25BARIN1M01052 PARI GULL ..."
    const parts = line.split(' ').filter(Boolean);
    if (parts.length < 2) continue;

    let rollIdx = -1;
    for (let i = 0; i < parts.length; i++) {
      if (looksLikeRollToken(parts[i])) {
        rollIdx = i;
        break;
      }
    }

    if (rollIdx >= 0) {
      const roll_no = parts[rollIdx].toUpperCase();
      const before = parts.slice(0, rollIdx).join(' ');
      const after = parts.slice(rollIdx + 1).join(' ');
      // If first token is serial number only
      const nameFromAfter = after.trim();
      let full_name = nameFromAfter;
      if (!full_name && before) {
        // roll might be last token: "PARI GULL F25..." handled by rollIdx scan from start
        continue;
      }
      if (/^\d+$/.test(parts[0]) && rollIdx === 1 && nameFromAfter) {
        full_name = nameFromAfter;
      } else if (rollIdx > 0 && nameFromAfter) {
        full_name = nameFromAfter;
      } else if (rollIdx > 0 && !nameFromAfter) {
        full_name = before.replace(/^\d+[\.\)]?\s*/, '').trim();
      }
      full_name = full_name.replace(/\s+/g, ' ').trim();
      if (!full_name || full_name.length < 2) continue;

      const key = roll_no.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ full_name, roll_no });
      continue;
    }

    // Pattern B: NAME ... ROLL (roll as last alphanumeric token)
    const cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();
    const m = cleaned.match(/^(.+?)\s+([A-Z][A-Z0-9]{9,})$/i);
    if (m) {
      const full_name = m[1].trim().replace(/\s+/g, ' ');
      const roll_no = m[2].trim().toUpperCase();
      if (looksLikeRollToken(roll_no)) {
        const key = roll_no.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ full_name, roll_no });
      }
    }
  }

  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { role } = await getAuthedUserAndRole(req);
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const supabase = getSupabaseAdmin();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const pdfBase64: string | undefined = body?.pdfBase64;
    const semesterId: string | undefined = body?.semesterId;
    const sectionId: string | undefined = body?.sectionId;

    if (!pdfBase64 || !semesterId || !sectionId) {
      return res.status(400).json({ error: 'Missing pdfBase64, semesterId, or sectionId' });
    }

    // Guard against Vercel payload/body limits (base64 inflates size ~4/3).
    // We estimate decoded bytes to fail fast with JSON.
    const approxDecodedBytes = Math.ceil((pdfBase64.length * 3) / 4);
    const MAX_DECoded_BYTES = 3_000_000; // match client guard
    if (approxDecodedBytes > MAX_DECoded_BYTES) {
      return res.status(413).json({
        error: `PDF too large for upload. Estimated decoded size ${(approxDecodedBytes / (1024 * 1024)).toFixed(2)}MB. Use a PDF under ~3MB.`,
      });
    }

    const buf = Buffer.from(pdfBase64, 'base64');
    if (buf.length > 6 * 1024 * 1024) {
      return res.status(413).json({ error: 'PDF too large (max ~6MB)' });
    }
    const text = await extractPdfText(buf);
    const rows = parseStudentLines(text || '');

    if (rows.length === 0) {
      await supabase.from('import_logs').insert({
        kind: 'section_pdf',
        message: 'No student rows parsed from PDF',
        meta: { semesterId, sectionId, sample: (text || '').slice(0, 1200) },
      });
      return res.status(200).json({
        ok: true,
        inserted: 0,
        skipped: 0,
        warnings: [
          'No rows matched. Ensure the PDF has selectable text (not only scanned images). Try exporting PDF from Word with embedded text.',
        ],
        textSample: (text || '').slice(0, 800),
      });
    }

    const { error: upsertErr } = await supabase.from('section_students').upsert(
      rows.map((r) => ({
        section_id: sectionId,
        roll_no: r.roll_no,
        full_name: r.full_name,
      })),
      { onConflict: 'section_id,roll_no' }
    );
    if (upsertErr) throw upsertErr;

    await supabase.from('import_logs').insert({
      kind: 'section_pdf',
      message: `Upserted ${rows.length} section students`,
      meta: { semesterId, sectionId, parsed: rows.length },
    });

    return res.status(200).json({ ok: true, inserted: rows.length, skipped: 0, totalParsed: rows.length, warnings: [] });
  } catch (e: any) {
    console.error('parse-section-pdf (handler failed)', e);
    return res.status(500).json({ error: e?.message ?? 'Parse failed' });
  }
}
