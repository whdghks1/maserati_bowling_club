// pages/api/reports/bungs/ranking.js
import { sql } from "../../../../src/db";

export default async function handler(req, res) {
    try {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

        const { from = null, to = null } = req.query;

        const fromVal = from ? String(from) : null;
        const toVal = to ? String(to) : null;

        // 유효 벙(4+)만 카운트
        const rows = await sql`
      with base_bungs as (
        select b.id
        from bungs b
        where (${fromVal}::timestamptz is null or b.bung_at >= ${fromVal}::timestamptz)
          and (${toVal}::timestamptz is null or b.bung_at < ${toVal}::timestamptz)
      ),
      valid_bungs as (
        select bb.id as bung_id
        from base_bungs bb
        join (
          select bung_id, count(*)::int as attendee_count
          from bung_attendees
          group by bung_id
        ) cnt on cnt.bung_id = bb.id
        where cnt.attendee_count >= 4
      )
      select
        m.id as member_id,
        m.name,
        count(*)::int as valid_count
      from bung_attendees ba
      join valid_bungs vb on vb.bung_id = ba.bung_id
      join members m on m.id = ba.member_id
      group by m.id, m.name
      order by valid_count desc, m.name asc
    `;

        const summaryRows = await sql`
      with base_bungs as (
        select b.id
        from bungs b
        where (${fromVal}::timestamptz is null or b.bung_at >= ${fromVal}::timestamptz)
          and (${toVal}::timestamptz is null or b.bung_at < ${toVal}::timestamptz)
      ),
      cnt as (
        select bung_id, count(*)::int as attendee_count
        from bung_attendees
        group by bung_id
      )
      select
        (select count(*)::int from base_bungs) as total_bungs,
        (select count(*)::int from base_bungs bb join cnt on cnt.bung_id = bb.id where cnt.attendee_count >= 4) as valid_bungs
    `;
        const s = summaryRows?.[0] ?? { total_bungs: 0, valid_bungs: 0 };

        return res.status(200).json({
            ok: true,
            filter: { from: fromVal, to: toVal },
            summary: {
                total_bungs: Number(s.total_bungs || 0),
                valid_bungs: Number(s.valid_bungs || 0),
            },
            rankings: rows,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
