// pages/api/regular-games.js
import { sql } from "../../src/db";

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

        const { meeting_id, member_id, game1, game2, game3 } = req.body || {};
        if (!meeting_id || !member_id) {
            return res.status(400).json({ error: "invalid_input", detail: "meeting_id, member_id 필요" });
        }

        const scores = [
            { game_no: 1, score: game1 },
            { game_no: 2, score: game2 },
            { game_no: 3, score: game3 },
        ];

        // 참가자 엔트리(regular_results)가 없으면 생성(선택: UI 흐름에 따라)
        await sql`
      insert into regular_results (meeting_id, member_id)
      values (${meeting_id}, ${member_id})
      on conflict (meeting_id, member_id) do nothing
    `;

        // 점수 upsert
        for (const s of scores) {
            if (s.score == null) continue; // 미입력 허용
            await sql`
        insert into regular_games (meeting_id, member_id, game_no, score)
        values (${meeting_id}, ${member_id}, ${s.game_no}, ${s.score})
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
