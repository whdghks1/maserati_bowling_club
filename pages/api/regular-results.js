// pages/api/regular-results.js
import { sql } from "../../src/db";

function round1(n) {
    return Math.round(n * 10) / 10;
}
function isValidScore(x) {
    return Number.isInteger(x) && x >= 0 && x <= 300;
}

export default async function handler(req, res) {
    try {
        // =========================
        // GET: 시즌/회차 결과 조회
        // =========================
        if (req.method === "GET") {
            const season = Number(req.query.season || new Date().getFullYear());
            const meetingNoRaw = req.query.meeting_no;
            const meeting_no = meetingNoRaw == null ? null : Number(meetingNoRaw);

            if (!Number.isFinite(season)) {
                return res.status(400).json({ error: "invalid_input", detail: "season이 올바르지 않습니다." });
            }

            const rows = await sql`
        with base as (
          select
            rm.id as meeting_id,
            rm.season,
            rm.meeting_no,
            rm.meeting_date,
            m.id as member_id,
            m.name,
            max(case when rg.game_no = 1 then rg.score end) as game1,
            max(case when rg.game_no = 2 then rg.score end) as game2,
            max(case when rg.game_no = 3 then rg.score end) as game3
          from regular_results rr
          join regular_meetings rm on rm.id = rr.meeting_id
          join members m on m.id = rr.member_id
          left join regular_games rg
            on rg.meeting_id = rr.meeting_id
           and rg.member_id  = rr.member_id
          where rm.season = ${season}
            and (${meeting_no}::int is null or rm.meeting_no = ${meeting_no})
          group by rm.id, rm.season, rm.meeting_no, rm.meeting_date, m.id, m.name
        )
        select
          season,
          meeting_no,
          meeting_date,
          member_id,
          name,
          game1,
          game2,
          game3,
          (coalesce(game1, 0) + coalesce(game2, 0) + coalesce(game3, 0))::int as total_pins
        from base
        order by meeting_no asc, total_pins desc, name asc
      `;

            // 에버는 API에서 계산해서 내려줌(편의)
            const out = rows.map((r) => ({
                ...r,
                average: round1((Number(r.total_pins) || 0) / 3),
            }));

            return res.status(200).json(out);
        }

        // =========================
        // POST: 시즌/회차/이름 + 3게임 저장(수정 포함)
        // =========================
        if (req.method === "POST") {
            const {
                season,
                meeting_no,
                meeting_date = null,
                name,
                game1,
                game2,
                game3,
            } = req.body || {};

            const s = Number(season);
            const no = Number(meeting_no);
            const nm = String(name || "").trim();

            const g1 = game1 === "" || game1 == null ? null : Number(game1);
            const g2 = game2 === "" || game2 == null ? null : Number(game2);
            const g3 = game3 === "" || game3 == null ? null : Number(game3);

            if (!Number.isFinite(s) || !Number.isFinite(no) || no <= 0) {
                return res.status(400).json({ error: "invalid_input", detail: "season, meeting_no가 필요합니다." });
            }
            if (!nm) {
                return res.status(400).json({ error: "invalid_input", detail: "name이 필요합니다." });
            }
            // 네가 말한대로 "3게임은 무조건 친다" 기준이면 null 금지로 강하게 잡아도 됨
            if (!isValidScore(g1) || !isValidScore(g2) || !isValidScore(g3)) {
                return res.status(400).json({ error: "invalid_input", detail: "game1~3은 0~300 정수(3게임 필수) 입니다." });
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

            // 2) member upsert (name unique)
            const memberRows = await sql`
        insert into members (name)
        values (${nm})
        on conflict (name)
        do update set name = excluded.name
        returning id, name
      `;
            const member = memberRows[0];

            // 3) 참가자 upsert (regular_results는 참가자 엔트리)
            await sql`
        insert into regular_results (meeting_id, member_id)
        values (${meeting.id}, ${member.id})
        on conflict (meeting_id, member_id) do nothing
      `;

            // 4) games upsert (수정 = 동일)
            const pairs = [
                [1, g1],
                [2, g2],
                [3, g3],
            ];

            for (const [game_no2, score] of pairs) {
                await sql`
          insert into regular_games (meeting_id, member_id, game_no, score)
          values (${meeting.id}, ${member.id}, ${game_no2}, ${score})
          on conflict (meeting_id, member_id, game_no)
          do update set score = excluded.score, updated_at = now()
        `;
            }

            const total = g1 + g2 + g3;

            return res.status(200).json({
                ok: true,
                meeting,
                member,
                result: {
                    meeting_id: meeting.id,
                    member_id: member.id,
                    game1: g1,
                    game2: g2,
                    game3: g3,
                    total_pins: total,
                    average: round1(total / 3),
                },
            });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
