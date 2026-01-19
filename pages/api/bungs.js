// pages/api/bungs.js
import { sql } from "../../src/db";

function normalizeBungAt(input) {
    // 입력:
    // - "2026-01-19T20:00" (datetime-local)
    // - "2026-01-19T20:00:00+09:00"
    // - "2026-01-19T11:00:00Z"
    // 처리:
    // - timezone 없는 경우 KST(+09:00)로 간주해서 붙여줌
    const s = String(input || "").trim();
    if (!s) return null;

    const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(s);
    if (hasTz) return s;

    // datetime-local은 보통 초 없음 → ":00" 붙이고 +09:00 붙임
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
        return `${s}:00+09:00`;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) {
        return `${s}:00+09:00`;
    }

    // 그 외는 그대로 시도
    return s;
}

export default async function handler(req, res) {
    try {
        if (req.method === "GET") {
            // 기본: 최근 60일
            const { from, to, limit } = req.query;
            const lim = Math.min(Math.max(Number(limit || 200), 1), 500);

            const rows = await sql`
        with base as (
          select
            b.id,
            b.bung_at,
            b.title,
            b.center_name,
            b.note,
            b.created_at
          from bungs b
          where (${from ?? null}::timestamptz is null or b.bung_at >= ${from}::timestamptz)
            and (${to ?? null}::timestamptz is null or b.bung_at < ${to}::timestamptz)
          order by b.bung_at desc
          limit ${lim}
        )
        select
          base.*,
          coalesce(cnt.attendee_count, 0) as attendee_count,
          (coalesce(cnt.attendee_count, 0) >= 4) as is_valid
        from base
        left join (
          select bung_id, count(*)::int as attendee_count
          from bung_attendees
          group by bung_id
        ) cnt on cnt.bung_id = base.id
        order by base.bung_at desc
      `;
            return res.status(200).json(rows);
        }

        if (req.method === "POST") {
            const { bung_at, title = null, center_name = null, note = null } = req.body || {};
            const bungAt = normalizeBungAt(bung_at);

            if (!bungAt) {
                return res.status(400).json({ error: "invalid_input", detail: "bung_at이 필요합니다." });
            }

            const rows = await sql`
        insert into bungs (bung_at, title, center_name, note)
        values (
          ${bungAt}::timestamptz,
          ${title},
          ${center_name},
          ${note}
        )
        on conflict (bung_at)
        do update set
          title = excluded.title,
          center_name = excluded.center_name,
          note = excluded.note
        returning id, bung_at, title, center_name, note, created_at
      `;

            return res.status(200).json({ ok: true, bung: rows[0] });
        }

        if (req.method === "DELETE") {
            const id = Number(req.query.id);
            if (!Number.isFinite(id)) {
                return res.status(400).json({ error: "invalid_input", detail: "id가 올바르지 않습니다." });
            }

            await sql`delete from bungs where id = ${id}`;
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
