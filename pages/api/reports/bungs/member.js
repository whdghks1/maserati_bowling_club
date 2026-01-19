// pages/api/reports/bungs/member.js
import { sql } from "../../../../src/db";

export default async function handler(req, res) {
    try {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

        const member_id = Number(req.query.member_id);
        if (!Number.isFinite(member_id)) {
            return res.status(400).json({ error: "invalid_input", detail: "member_id가 필요합니다." });
        }

        const from = req.query.from || null;
        const to = req.query.to || null;

        const memberRows = await sql`select id as member_id, name from members where id = ${member_id}`;
        if (!memberRows[0]) return res.status(404).json({ error: "not_found", detail: "멤버를 찾을 수 없습니다." });

        // (A) 벙 참여(유효/비유효 모두)
        const bungs = await sql`
      select
        b.id as bung_id,
        b.bung_at,
        b.title,
        b.center_name,
        (select count(*)::int from bung_attendees ba2 where ba2.bung_id = b.id) as attendee_count,
        ((select count(*) from bung_attendees ba3 where ba3.bung_id = b.id) >= 4) as is_valid
      from bung_attendees ba
      join bungs b on b.id = ba.bung_id
      where ba.member_id = ${member_id}
        and (${from}::timestamptz is null or b.bung_at >= ${from}::timestamptz)
        and (${to}::timestamptz is null or b.bung_at <= ${to}::timestamptz)
      order by b.bung_at desc
    `;

        // (B) 정기전 참가(regular_results) + 게임점수(regular_games) 조합
        const regularMeetings = await sql`
      select
        rm.id as meeting_id,
        rm.season,
        rm.meeting_no,
        rm.meeting_date
      from regular_results rr
      join regular_meetings rm on rm.id = rr.meeting_id
      where rr.member_id = ${member_id}
        and rm.meeting_date is not null
        and (${from}::timestamptz is null or rm.meeting_date >= (${from}::timestamptz at time zone 'Asia/Seoul')::date)
        and (${to}::timestamptz is null or rm.meeting_date <= (${to}::timestamptz at time zone 'Asia/Seoul')::date)
      order by rm.meeting_date desc, rm.meeting_no desc
    `;

        const meetingIds = regularMeetings.map((r) => r.meeting_id);

        let gameRows = [];
        if (meetingIds.length > 0) {
            gameRows = await sql`
        select meeting_id, game_no, score
        from regular_games
        where member_id = ${member_id}
          and meeting_id = any(${meetingIds}::bigint[])
        order by meeting_id desc, game_no asc
      `;
        }

        const scoreByMeeting = new Map();
        for (const g of gameRows) {
            const obj = scoreByMeeting.get(g.meeting_id) || { game1: null, game2: null, game3: null };
            if (g.game_no === 1) obj.game1 = g.score;
            if (g.game_no === 2) obj.game2 = g.score;
            if (g.game_no === 3) obj.game3 = g.score;
            scoreByMeeting.set(g.meeting_id, obj);
        }

        const regularItems = regularMeetings.map((rm) => {
            const s = scoreByMeeting.get(rm.meeting_id) || { game1: null, game2: null, game3: null };
            const total = (s.game1 ?? 0) + (s.game2 ?? 0) + (s.game3 ?? 0);
            const avg = Math.round((total / 3) * 10) / 10;
            return {
                type: "regular",
                meeting_id: rm.meeting_id,
                meeting_date: rm.meeting_date,
                title: `정기전 ${rm.meeting_no}회차`,
                game1: s.game1,
                game2: s.game2,
                game3: s.game3,
                total_pins: total,
                average: avg,
                date_key: String(rm.meeting_date),
            };
        });

        const items = [
            ...bungs.map((b) => ({
                type: "bung",
                bung_id: b.bung_id,
                bung_at: b.bung_at,
                title: b.title || "",
                center_name: b.center_name || "",
                attendee_count: b.attendee_count,
                is_valid: !!b.is_valid,
            })),
            ...regularItems,
        ].sort((a, b) => {
            const ta = a.type === "bung" ? new Date(a.bung_at).getTime() : new Date(a.meeting_date).getTime();
            const tb = b.type === "bung" ? new Date(b.bung_at).getTime() : new Date(b.meeting_date).getTime();
            return tb - ta;
        });

        return res.status(200).json({
            member: memberRows[0],
            items,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
