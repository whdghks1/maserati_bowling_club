// pages/api/reports/bungs/member.js
import { sql } from "../../../../src/db";

export default async function handler(req, res) {
    try {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

        const member_id = Number(req.query.member_id);
        const { from = null, to = null } = req.query;

        if (!Number.isFinite(member_id)) {
            return res.status(400).json({ error: "invalid_input", detail: "member_id가 필요합니다." });
        }

        const fromVal = from ? String(from) : null;
        const toVal = to ? String(to) : null;

        const rows = await sql`
      with base_bungs as (
        select
          b.id,
          b.bung_at,
          b.title,
          b.center_name
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
        bb.id as bung_id,
        bb.bung_at,
        bb.title,
        bb.center_name,
        coalesce(cnt.attendee_count, 0) as attendee_count,
        (coalesce(cnt.attendee_count, 0) >= 4) as is_valid
      from base_bungs bb
      join bung_attendees ba on ba.bung_id = bb.id
      left join cnt on cnt.bung_id = bb.id
      where ba.member_id = ${member_id}
      order by bb.bung_at desc
    `;

        return res.status(200).json({
            ok: true,
            filter: { from: fromVal, to: toVal },
            items: rows.map((r) => ({
                bung_id: r.bung_id,
                bung_at: r.bung_at,
                title: r.title,
                center_name: r.center_name,
                attendee_count: Number(r.attendee_count || 0),
                is_valid: !!r.is_valid,
            })),
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
