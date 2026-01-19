// pages/api/regular/participants.js
import { sql } from "../../../src/db";

export default async function handler(req, res) {
    try {
        if (req.method === "POST") {
            const { meeting_id, member_id } = req.body || {};
            if (!meeting_id || !member_id) {
                return res.status(400).json({ error: "invalid_input", detail: "meeting_id, member_id 필요" });
            }

            await sql`
        insert into regular_results (meeting_id, member_id)
        values (${meeting_id}, ${member_id})
        on conflict (meeting_id, member_id) do nothing
      `;

            return res.status(200).json({ ok: true });
        }

        if (req.method === "DELETE") {
            const meeting_id = Number(req.query.meeting_id);
            const member_id = Number(req.query.member_id);
            if (!Number.isFinite(meeting_id) || !Number.isFinite(member_id)) {
                return res.status(400).json({ error: "invalid_input", detail: "meeting_id, member_id 필요" });
            }

            // games는 FK cascade로 같이 삭제됨(regular_games -> meeting/member FK가 CASCADE)
            await sql`delete from regular_results where meeting_id = ${meeting_id} and member_id = ${member_id}`;

            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
