// pages/api/regular/meeting.js
import { sql } from "../../../src/db";

function round1(n) {
    return Math.round(n * 10) / 10;
}

export default async function handler(req, res) {
    try {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

        const meeting_id = Number(req.query.id);
        if (!Number.isFinite(meeting_id)) {
            return res.status(400).json({ error: "invalid_input", detail: "id(meeting_id)가 필요합니다." });
        }

        const meetingRows = await sql`
      select id as meeting_id, season, meeting_no, meeting_date
      from regular_meetings
      where id = ${meeting_id}
    `;
        if (!meetingRows[0]) return res.status(404).json({ error: "not_found", detail: "정기전 회차를 찾을 수 없습니다." });

        const participants = await sql`
      select rr.member_id, m.name
      from regular_results rr
      join members m on m.id = rr.member_id
      where rr.meeting_id = ${meeting_id}
      order by m.name asc
    `;

        const games = await sql`
      select member_id, game_no, score
      from regular_games
      where meeting_id = ${meeting_id}
      order by member_id asc, game_no asc
    `;

        const scoreMap = new Map(); // member_id -> {g1,g2,g3}
        for (const g of games) {
            const obj = scoreMap.get(g.member_id) || { game1: null, game2: null, game3: null };
            if (g.game_no === 1) obj.game1 = g.score;
            if (g.game_no === 2) obj.game2 = g.score;
            if (g.game_no === 3) obj.game3 = g.score;
            scoreMap.set(g.member_id, obj);
        }

        const rows = participants.map((p) => {
            const s = scoreMap.get(p.member_id) || { game1: null, game2: null, game3: null };
            const total = (s.game1 ?? 0) + (s.game2 ?? 0) + (s.game3 ?? 0);
            const avg = round1(total / 3);
            return {
                member_id: p.member_id,
                name: p.name,
                game1: s.game1,
                game2: s.game2,
                game3: s.game3,
                total_pins: total,
                average: avg,
            };
        });

        // ✅ 에버순(내림차순) + 동률이면 합계 + 이름
        rows.sort((a, b) => (b.average - a.average) || (b.total_pins - a.total_pins) || a.name.localeCompare(b.name, "ko"));

        return res.status(200).json({ meeting: meetingRows[0], results: rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
