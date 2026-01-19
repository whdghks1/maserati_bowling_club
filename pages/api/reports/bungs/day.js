// pages/api/reports/bungs/day.js
import { sql } from "../../../../src/db";

export default async function handler(req, res) {
    try {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

        const date = String(req.query.date || "").trim(); // YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: "invalid_input", detail: "date(YYYY-MM-DD)가 필요합니다." });
        }

        const start = `${date}T00:00:00+09:00`;
        const end = `${date}T23:59:59+09:00`;

        const rows = await sql`
      with day_bungs as (
        select
          b.id,
          b.bung_at,
          b.title,
          b.center_name
        from bungs b
        where b.bung_at >= ${start}::timestamptz
          and b.bung_at <= ${end}::timestamptz
      ),
      cnt as (
        select bung_id, count(*)::int as attendee_count
        from bung_attendees
        group by bung_id
      )
      select
        db.id as bung_id,
        db.bung_at,
        db.title,
        db.center_name,
        coalesce(cnt.attendee_count, 0) as attendee_count,
        (coalesce(cnt.attendee_count, 0) >= 4) as is_valid,
        coalesce(
          (
            select json_agg(json_build_object('member_id', m.id, 'name', m.name) order by m.name)
            from bung_attendees ba
            join members m on m.id = ba.member_id
            where ba.bung_id = db.id
          ),
          '[]'::json
        ) as attendees
      from day_bungs db
      left join cnt on cnt.bung_id = db.id
      order by db.bung_at asc
    `;

        return res.status(200).json({
            ok: true,
            date,
            bungs: rows.map((r) => ({
                bung_id: r.bung_id,
                bung_at: r.bung_at,
                title: r.title,
                center_name: r.center_name,
                attendee_count: Number(r.attendee_count || 0),
                is_valid: !!r.is_valid,
                attendees: r.attendees,
            })),
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
