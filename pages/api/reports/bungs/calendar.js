// pages/api/reports/bungs/calendar.js
import { sql } from "../../../../src/db";

function buildNamesPreview(names = [], max = 2) {
  const cleaned = names.filter(Boolean);
  const head = cleaned.slice(0, max);
  const more = cleaned.length > max;
  return head.join(", ") + (more ? "…" : "");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const month = String(req.query.month || "").trim(); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "invalid_input", detail: "month=YYYY-MM 이 필요합니다." });
    }

    const monthStart = `${month}-01`; // 문자열로만 유지

    // ==============
    // 1) 벙 (bungs)
    // ==============
    const bungs = await sql`
      with rng as (
        select
          date_trunc('month', ${monthStart}::date)::date as start_date,
          (date_trunc('month', ${monthStart}::date) + interval '1 month' - interval '1 day')::date as end_date
      )
      select
        (b.bung_at at time zone 'Asia/Seoul')::date as day_key,
        b.id as bung_id,
        b.bung_at,
        b.title,
        b.center_name,
        count(ba.id)::int as attendee_count,
        (count(ba.id) >= 4) as is_valid,
        array_remove(array_agg(m.name order by m.name), null) as names
      from bungs b
      left join bung_attendees ba on ba.bung_id = b.id
      left join members m on m.id = ba.member_id
      cross join rng
      where (b.bung_at at time zone 'Asia/Seoul')::date between rng.start_date and rng.end_date
      group by b.id
      order by b.bung_at asc
    `;

    // =======================
    // 2) 정기전 (regular_meetings)
    // =======================
    const regulars = await sql`
      with rng as (
        select
          date_trunc('month', ${monthStart}::date)::date as start_date,
          (date_trunc('month', ${monthStart}::date) + interval '1 month' - interval '1 day')::date as end_date
      )
      select
        rm.meeting_date::date as day_key,
        rm.id as meeting_id,
        rm.season,
        rm.meeting_no,
        rm.meeting_date,
        count(rr.member_id)::int as attendee_count,
        array_remove(array_agg(mem.name order by mem.name), null) as names
      from regular_meetings rm
      left join regular_results rr on rr.meeting_id = rm.id
      left join members mem on mem.id = rr.member_id
      cross join rng
      where rm.meeting_date is not null
        and rm.meeting_date between rng.start_date and rng.end_date
      group by rm.id
      order by rm.meeting_date asc, rm.meeting_no asc
    `;

    // ============
    // 3) 캘린더 맵 구성
    // ============
    const calendarDays = {};

    for (const b of bungs) {
      const dayKey = String(b.day_key); // "YYYY-MM-DD"
      calendarDays[dayKey] = calendarDays[dayKey] || [];
      calendarDays[dayKey].push({
        event_type: "bung",
        bung_id: b.bung_id,
        bung_at: b.bung_at,
        title: b.title || "",
        center_name: b.center_name || "",
        attendee_count: b.attendee_count,
        is_valid: !!b.is_valid,
        attendee_names_preview: buildNamesPreview(b.names || [], 2),
      });
    }

    for (const r of regulars) {
      const dayKey = String(r.day_key);
      calendarDays[dayKey] = calendarDays[dayKey] || [];
      calendarDays[dayKey].push({
        event_type: "regular",
        meeting_id: r.meeting_id,
        meeting_date: r.meeting_date,
        title: `정기전 ${r.meeting_no}회차`,
        attendee_count: r.attendee_count,
        is_valid: true,
        attendee_names_preview: buildNamesPreview(r.names || [], 2),
      });
    }

    // ✅ 유효벙 -> 비유효벙 -> 정기전 순
    for (const dayKey of Object.keys(calendarDays)) {
      calendarDays[dayKey].sort((a, b) => {
        const rank = (x) => {
          if (x.event_type === "bung") return x.is_valid ? 0 : 1;
          if (x.event_type === "regular") return 2;
          return 9;
        };
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;

        const ta = a.event_type === "bung" ? new Date(a.bung_at).getTime() : 0;
        const tb = b.event_type === "bung" ? new Date(b.bung_at).getTime() : 0;
        return ta - tb;
      });
    }

    return res.status(200).json({ calendarDays });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
  }
}
