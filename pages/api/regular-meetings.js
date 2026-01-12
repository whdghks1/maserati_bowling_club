// pages/api/regular-meetings.js
import { sql } from "../../src/db";

export default async function handler(req, res) {
    try {
        if (req.method === "GET") {
            const season = Number(req.query.season || new Date().getFullYear());
            const rows = await sql`
        select id, season, meeting_no, meeting_date
        from regular_meetings
        where season = ${season}
        order by meeting_no asc
      `;
            return res.status(200).json(rows);
        }

        if (req.method === "POST") {
            const { season, meeting_no, meeting_date = null } = req.body || {};
            const s = Number(season);
            const no = Number(meeting_no);

            if (!Number.isFinite(s) || !Number.isFinite(no) || no <= 0) {
                return res.status(400).json({ error: "invalid_input", detail: "season, meeting_no가 필요합니다." });
            }

            const rows = await sql`
        insert into regular_meetings (season, meeting_no, meeting_date)
        values (${s}, ${no}, ${meeting_date})
        on conflict (season, meeting_no)
        do update set meeting_date = coalesce(excluded.meeting_date, regular_meetings.meeting_date)
        returning id, season, meeting_no, meeting_date
      `;

            return res.status(200).json(rows[0]);
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
