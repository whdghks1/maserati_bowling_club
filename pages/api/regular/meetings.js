// pages/api/regular/meetings.js
import { sql } from "../../../src/db";

export default async function handler(req, res) {
    try {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

        const limit = Math.min(Number(req.query.limit || 200), 500);

        const rows = await sql`
      with p as (
        select
          rr.meeting_id,
          count(*)::int as participant_count
        from regular_results rr
        group by rr.meeting_id
      ),
      g as (
        select
          rg.meeting_id,
          rg.member_id,
          count(*)::int as games_filled
        from regular_games rg
        group by rg.meeting_id, rg.member_id
      ),
      c as (
        select
          rr.meeting_id,
          sum(case when coalesce(g.games_filled, 0) = 3 then 1 else 0 end)::int as complete_count
        from regular_results rr
        left join g on g.meeting_id = rr.meeting_id and g.member_id = rr.member_id
        group by rr.meeting_id
      )
      select
        rm.id as meeting_id,
        rm.season,
        rm.meeting_no,
        rm.meeting_date,
        coalesce(p.participant_count, 0)::int as participant_count,
        coalesce(c.complete_count, 0)::int as complete_count
      from regular_meetings rm
      left join p on p.meeting_id = rm.id
      left join c on c.meeting_id = rm.id
      order by rm.meeting_date desc nulls last, rm.season desc, rm.meeting_no desc
      limit ${limit}
    `;

        return res.status(200).json({ meetings: rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
