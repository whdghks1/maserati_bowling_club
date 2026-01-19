// pages/api/reports/bungs/day.js
import { sql } from "../../../../src/db";

export default async function handler(req, res) {
    try {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

        const date = String(req.query.date || "").trim(); // YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: "invalid_input", detail: "date=YYYY-MM-DD 가 필요합니다." });
        }

        // (A) 그날의 벙들 + 참석자
        const bungs = await sql`
      select
        b.id as bung_id,
        b.bung_at,
        b.title,
        b.center_name,
        count(ba.id)::int as attendee_count,
        (count(ba.id) >= 4) as is_valid
      from bungs b
      left join bung_attendees ba on ba.bung_id = b.id
      where (b.bung_at at time zone 'Asia/Seoul')::date = ${date}::date
      group by b.id
      order by b.bung_at asc
    `;

        const bungIds = bungs.map((x) => x.bung_id);
        let attendeesMap = new Map();
        if (bungIds.length > 0) {
            const rows = await sql`
        select ba.bung_id, m.id as member_id, m.name
        from bung_attendees ba
        join members m on m.id = ba.member_id
        where ba.bung_id = any(${bungIds}::bigint[])
        order by ba.bung_id asc, m.name asc
      `;
            for (const r of rows) {
                const arr = attendeesMap.get(r.bung_id) || [];
                arr.push({ member_id: r.member_id, name: r.name });
                attendeesMap.set(r.bung_id, arr);
            }
        }

        const bungOut = bungs.map((b) => ({
            ...b,
            event_type: "bung",
            attendees: attendeesMap.get(b.bung_id) || [],
        }));

        // (B) 그날 정기전(regular_meetings) + 게임 점수(regular_games)
        const meetings = await sql`
      select id as meeting_id, season, meeting_no, meeting_date
      from regular_meetings
      where meeting_date = ${date}::date
      order by season desc, meeting_no asc
    `;

        const meetingIds = meetings.map((m) => m.meeting_id);

        // 참가자(regular_results) 기반으로 멤버 목록 확보
        // 게임 입력이 일부만 있어도 참가자는 보여주고, 없는 게임은 null로 둠
        let regularOut = [];
        if (meetingIds.length > 0) {
            // 참가자 목록
            const participants = await sql`
        select rr.meeting_id, rr.member_id, mem.name
        from regular_results rr
        join members mem on mem.id = rr.member_id
        where rr.meeting_id = any(${meetingIds}::bigint[])
        order by rr.meeting_id asc, mem.name asc
      `;

            // 게임 점수들
            const games = await sql`
        select meeting_id, member_id, game_no, score
        from regular_games
        where meeting_id = any(${meetingIds}::bigint[])
        order by meeting_id asc, member_id asc, game_no asc
      `;

            // (meeting_id, member_id) -> {g1,g2,g3}
            const scoreMap = new Map();
            for (const g of games) {
                const key = `${g.meeting_id}:${g.member_id}`;
                const obj = scoreMap.get(key) || { game1: null, game2: null, game3: null };
                if (g.game_no === 1) obj.game1 = g.score;
                if (g.game_no === 2) obj.game2 = g.score;
                if (g.game_no === 3) obj.game3 = g.score;
                scoreMap.set(key, obj);
            }

            // meeting별로 결과 구성
            for (const m of meetings) {
                const rows = participants.filter((p) => p.meeting_id === m.meeting_id).map((p) => {
                    const key = `${p.meeting_id}:${p.member_id}`;
                    const s = scoreMap.get(key) || { game1: null, game2: null, game3: null };
                    const total =
                        (s.game1 ?? 0) + (s.game2 ?? 0) + (s.game3 ?? 0);
                    const avg = Math.round((total / 3) * 10) / 10;

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

                // ✅ 에버 순(내림차순), 동률이면 합계, 그 다음 이름
                rows.sort((a, b) => (b.average - a.average) || (b.total_pins - a.total_pins) || a.name.localeCompare(b.name, "ko"));

                regularOut.push({
                    event_type: "regular",
                    meeting_id: m.meeting_id,
                    season: m.season,
                    meeting_no: m.meeting_no,
                    meeting_date: m.meeting_date,
                    results: rows,
                });
            }
        }

        return res.status(200).json({
            date,
            bungs: bungOut,
            regular_meetings: regularOut,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
