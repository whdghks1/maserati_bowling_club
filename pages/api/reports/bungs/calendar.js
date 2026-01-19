// pages/api/reports/bungs/calendar.js
import { sql } from "../../../../src/db";

function ensureMonth(month) {
    const m = String(month || "").trim();
    if (!/^\d{4}-\d{2}$/.test(m)) return null;
    return m;
}

export default async function handler(req, res) {
    try {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

        const { month, from = null, to = null } = req.query;
        const monthStr = ensureMonth(month);
        if (!monthStr) return res.status(400).json({ error: "invalid_input", detail: "month(YYYY-MM)가 필요합니다." });

        const fromVal = from ? String(from) : null;
        const toVal = to ? String(to) : null;

        const start = `${monthStr}-01`;

        // 해당 월 + (옵션) from/to 범위 내의 벙만
        const rows = await sql`
      with month_bungs as (
        select
          b.id,
          b.bung_at,
          b.title,
          b.center_name,
          b.note
        from bungs b
        where b.bung_at >= ${start}::date
          and b.bung_at < (${start}::date + interval '1 month')::date
          and (${fromVal}::timestamptz is null or b.bung_at >= ${fromVal}::timestamptz)
          and (${toVal}::timestamptz is null or b.bung_at < ${toVal}::timestamptz)
      ),
      cnt as (
        select bung_id, count(*)::int as attendee_count
        from bung_attendees
        group by bung_id
      ),
      names as (
        select
          ba.bung_id,
          array_agg(m.name order by m.name) as all_names
        from bung_attendees ba
        join members m on m.id = ba.member_id
        group by ba.bung_id
      )
      select
        mb.id as bung_id,
        mb.bung_at,
        mb.title,
        mb.center_name,
        coalesce(cnt.attendee_count, 0) as attendee_count,
        (coalesce(cnt.attendee_count, 0) >= 4) as is_valid,
        -- 미리보기(최대 3명 + ...), 없으면 null
        case
          when names.all_names is null then null
          when array_length(names.all_names, 1) <= 3
            then array_to_string(names.all_names, ', ')
          else array_to_string(names.all_names[1:3], ', ') || '…'
        end as attendee_names_preview
      from month_bungs mb
      left join cnt on cnt.bung_id = mb.id
      left join names on names.bung_id = mb.id
      order by mb.bung_at asc
    `;

        // day map 생성: { "YYYY-MM-DD": [ ... ] }
        const dayMap = {};
        for (const r of rows) {
            const d = new Date(r.bung_at);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const key = `${yyyy}-${mm}-${dd}`;
            if (!dayMap[key]) dayMap[key] = [];
            dayMap[key].push({
                bung_id: r.bung_id,
                bung_at: r.bung_at,
                title: r.title,
                center_name: r.center_name,
                attendee_count: Number(r.attendee_count || 0),
                is_valid: !!r.is_valid,
                attendee_names_preview: r.attendee_names_preview,
            });
        }

        return res.status(200).json({
            ok: true,
            month: monthStr,
            filter: { from: fromVal, to: toVal },
            calendarDays: dayMap,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
