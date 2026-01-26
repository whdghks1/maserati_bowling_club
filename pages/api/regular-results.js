// pages/api/regular-results.js
import { sql } from "../../src/db";

function toInt(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function validateGame(n, label) {
    if (n == null) return; // 3게임 항상 있다 했지만, 일단 null 허용 (과거 데이터 대비)
    if (!Number.isFinite(n) || n < 0 || n > 300) {
        throw new Error(`${label}는 0~300 입니다.`);
    }
}

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
          rm.id as meeting_id,
          rm.season,
          rm.meeting_no,
          rm.meeting_date,
          m.id as member_id,
          m.name,
          rr.game1,
          rr.game2,
          rr.game3,
          coalesce(rr.game1,0) + coalesce(rr.game2,0) + coalesce(rr.game3,0) as total_pins,
          floor((coalesce(rr.game1,0) + coalesce(rr.game2,0) + coalesce(rr.game3,0)) / 3.0) as average
        from regular_results rr
        join regular_meetings rm on rm.id = rr.meeting_id
        join members m on m.id = rr.member_id
        where rm.season = ${season}
          and (${meeting_no}::int is null or rm.meeting_no = ${meeting_no})
        order by rm.meeting_no asc,
                 (coalesce(rr.game1,0) + coalesce(rr.game2,0) + coalesce(rr.game3,0)) desc,
                 m.name asc
      `;

            return res.status(200).json(rows);
        }

        if (req.method === "POST") {
            // ✅ 3게임 저장
            const { season, meeting_no, meeting_date = null, name, game1, game2, game3 } = req.body || {};

            const s = Number(season);
            const no = Number(meeting_no);
            const nm = String(name || "").trim();

            const g1 = toInt(game1);
            const g2 = toInt(game2);
            const g3 = toInt(game3);

            if (!Number.isFinite(s) || !Number.isFinite(no) || no <= 0) {
                return res.status(400).json({ error: "invalid_input", detail: "season, meeting_no가 필요합니다." });
            }
            if (!nm) {
                return res.status(400).json({ error: "invalid_input", detail: "name이 필요합니다." });
            }

            try {
                validateGame(g1, "game1");
                validateGame(g2, "game2");
                validateGame(g3, "game3");
            } catch (e) {
                return res.status(400).json({ error: "invalid_input", detail: e.message });
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

            // 2) member upsert
            const memberRows = await sql`
        insert into members (name)
        values (${nm})
        on conflict (name)
        do update set name = excluded.name
        returning id, name
      `;
            const member = memberRows[0];

            // 3) result upsert (3게임 덮어쓰기)
            const resultRows = await sql`
        insert into regular_results (meeting_id, member_id, game1, game2, game3)
        values (${meeting.id}, ${member.id}, ${g1}, ${g2}, ${g3})
        on conflict (meeting_id, member_id)
        do update set
          game1 = excluded.game1,
          game2 = excluded.game2,
          game3 = excluded.game3,
          updated_at = now()
        returning id, meeting_id, member_id, game1, game2, game3
      `;
            const result = resultRows[0];

            const total_pins = (result.game1 || 0) + (result.game2 || 0) + (result.game3 || 0);
            const average = Math.floor(total_pins / 3);

            return res.status(200).json({ ok: true, meeting, member, result: { ...result, total_pins, average } });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
