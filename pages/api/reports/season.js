// pages/api/reports/season.js
import { sql } from "../../../src/db";

function calcLevel(avg) {
    // avg: 게임당 에버리지
    if (avg == null || !Number.isFinite(avg)) return null;
    if (avg <= 120) return 1;
    if (avg <= 140) return 2;
    if (avg <= 150) return 3;
    if (avg <= 160) return 4;
    if (avg <= 170) return 5;
    if (avg <= 180) return 6;
    if (avg <= 190) return 7;
    if (avg <= 200) return 8;
    if (avg <= 210) return 9;
    if (avg <= 220) return 10;
    return 11; // 221+
}

export default async function handler(req, res) {
    try {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

        const season = Number(req.query.season || new Date().getFullYear());
        if (!Number.isFinite(season)) {
            return res.status(400).json({ error: "invalid_input", detail: "season이 올바르지 않습니다." });
        }

        // 1) 회차 목록
        const meetings = await sql`
      select id, season, meeting_no, meeting_date
      from regular_meetings
      where season = ${season}
      order by meeting_no asc
    `;

        // 2) 시즌 전체 결과(행)
        const results = await sql`
      select
        rm.meeting_no,
        m.name,
        rr.total_pins
      from regular_results rr
      join regular_meetings rm on rm.id = rr.meeting_id
      join members m on m.id = rr.member_id
      where rm.season = ${season}
      order by m.name asc, rm.meeting_no asc
    `;

        // 3) JS에서 멤버별 집계 + 회차별 점수 맵 생성
        const map = new Map(); // name -> {name, totalPins, attendCount, scoresByMeetingNo:{}}

        for (const r of results) {
            const name = r.name;
            const meetingNo = Number(r.meeting_no);
            const pins = Number(r.total_pins);

            if (!map.has(name)) {
                map.set(name, {
                    name,
                    total_pins: 0,
                    attend_count: 0,
                    scores: {}, // { [meetingNo]: pins }
                });
            }

            const row = map.get(name);
            // 같은 회차는 unique라서 사실 중복 없음. 그래도 안전하게 덮어쓰기.
            if (row.scores[meetingNo] == null) row.attend_count += 1;
            row.scores[meetingNo] = pins;
            row.total_pins += pins;
        }

        const rows = Array.from(map.values()).map((r) => {
            const games = r.attend_count * 3; // 회차당 3게임 고정
            const avg = games > 0 ? r.total_pins / games : null;
            const level = avg != null ? calcLevel(avg) : null;
            return {
                name: r.name,
                total_pins: r.total_pins,
                attend_count: r.attend_count,
                games_played: games,
                average: avg != null ? Number(avg.toFixed(1)) : null,
                level,
                scores: r.scores, // 회차별 3게임 합
            };
        });

        // 총핀 내림차순 정렬 (동점이면 average, 이름)
        rows.sort((a, b) => {
            if (b.total_pins !== a.total_pins) return b.total_pins - a.total_pins;
            const av = (b.average ?? -1) - (a.average ?? -1);
            if (av !== 0) return av;
            return a.name.localeCompare(b.name, "ko");
        });

        return res.status(200).json({
            season,
            meetings,
            rows,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
