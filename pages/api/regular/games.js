// pages/api/regular/games.js
import { sql } from "../../../src/db";

function isValidScore(x) {
    return Number.isInteger(x) && x >= 0 && x <= 300;
}

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

        const { meeting_id, member_id, game1, game2, game3 } = req.body || {};
        if (!meeting_id || !member_id) {
            return res.status(400).json({ error: "invalid_input", detail: "meeting_id, member_id 필요" });
        }

        // 참가자 엔트리 없으면 생성(입력=수정 공통 UX)
        await sql`
      insert into regular_results (meeting_id, member_id)
      values (${meeting_id}, ${member_id})
      on conflict (meeting_id, member_id) do nothing
    `;

        const pairs = [
            [1, game1],
            [2, game2],
            [3, game3],
        ];

        for (const [game_no, val] of pairs) {
            if (val === "" || val == null) {
                // 빈 값은 해당 게임 삭제(수정 시 지우기 가능)
                await sql`delete from regular_games where meeting_id=${meeting_id} and member_id=${member_id} and game_no=${game_no}`;
                continue;
            }

            const score = Number(val);
            if (!isValidScore(score)) {
                return res.status(400).json({ error: "invalid_score", detail: `game${game_no} 점수는 0~300 정수` });
            }

            await sql`
        insert into regular_games (meeting_id, member_id, game_no, score)
        values (${meeting_id}, ${member_id}, ${game_no}, ${score})
        on conflict (meeting_id, member_id, game_no)
        do update set score = excluded.score, updated_at = now()
      `;
        }

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
