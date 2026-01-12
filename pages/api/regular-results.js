// pages/api/regular-results.js
import { sql } from "../../src/db";

export default async function handler(req, res) {
    try {
        if (req.method === "GET") {
            const season = Number(req.query.season || new Date().getFullYear());
            const meetingNoRaw = req.query.meeting_no;
            const meeting_no = meetingNoRaw == null ? null : Number(meetingNoRaw);

            if (!Number.isFinite(season)) {
                return res.status(400).json({ error: "invalid_input", detail: "season이 올바르지 않습니다." });
            }

            const rows = await sql`
        select
          rm.season,
          rm.meeting_no,
          rm.meeting_date,
          m.name,
          rr.total_pins
        from regular_results rr
        join regular_meetings rm on rm.id = rr.meeting_id
        join members m on m.id = rr.member_id
        where rm.season = ${season}
          and (${meeting_no}::int is null or rm.meeting_no = ${meeting_no})
        order by rm.meeting_no asc, rr.total_pins desc, m.name asc
      `;

            return res.status(200).json(rows);
        }

        if (req.method === "POST") {
            const { season, meeting_no, meeting_date = null, name, total_pins } = req.body || {};

            const s = Number(season);
            const no = Number(meeting_no);
            const pins = Number(total_pins);
            const nm = String(name || "").trim();

            if (!Number.isFinite(s) || !Number.isFinite(no) || no <= 0) {
                return res.status(400).json({ error: "invalid_input", detail: "season, meeting_no가 필요합니다." });
            }
            if (!nm) {
                return res.status(400).json({ error: "invalid_input", detail: "name이 필요합니다." });
            }
            if (!Number.isFinite(pins) || pins < 0 || pins > 900) {
                return res.status(400).json({ error: "invalid_input", detail: "total_pins는 0~900(3게임 합) 입니다." });
            }

            // 1) meeting upsert
            const meetingRows = await sql`
        insert into regular_meetings (season, meeting_no, meeting_date)
        values (${s}, ${no}, ${meeting_date})
        on conflict (season, meeting_no)
        do update set meeting_date = coalesce(excluded.meeting_date, regular_meetings.meeting_date)
        returning id, season, meeting_no, meeting_date
      `;
            const meeting = meetingRows[0];

            // 2) member upsert (이름 중복 금지: unique(name))
            const memberRows = await sql`
        insert into members (name)
        values (${nm})
        on conflict (name)
        do update set name = excluded.name
        returning id, name
      `;
            const member = memberRows[0];

            // 3) result upsert (덮어쓰기)
            const resultRows = await sql`
        insert into regular_results (meeting_id, member_id, total_pins)
        values (${meeting.id}, ${member.id}, ${pins})
        on conflict (meeting_id, member_id)
        do update set
          total_pins = excluded.total_pins,
          updated_at = now()
        returning id, meeting_id, member_id, total_pins
      `;
            const result = resultRows[0];

            return res.status(200).json({
                ok: true,
                meeting,
                member,
                result,
            });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
