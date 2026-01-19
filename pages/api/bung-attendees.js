// pages/api/bung-attendees.js
import { sql } from "../../src/db";

export default async function handler(req, res) {
    try {
        if (req.method === "GET") {
            const bung_id = Number(req.query.bung_id);
            if (!Number.isFinite(bung_id)) {
                return res.status(400).json({ error: "invalid_input", detail: "bung_id가 필요합니다." });
            }

            const rows = await sql`
        select
          ba.bung_id,
          ba.member_id,
          m.name,
          ba.joined_at
        from bung_attendees ba
        join members m on m.id = ba.member_id
        where ba.bung_id = ${bung_id}
        order by ba.joined_at asc, m.name asc
      `;
            return res.status(200).json(rows);
        }

        if (req.method === "POST") {
            const { bung_id, member_id } = req.body || {};
            const b = Number(bung_id);
            const m = Number(member_id);

            if (!Number.isFinite(b) || !Number.isFinite(m)) {
                return res.status(400).json({ error: "invalid_input", detail: "bung_id, member_id가 필요합니다." });
            }

            await sql`
        insert into bung_attendees (bung_id, member_id)
        values (${b}, ${m})
        on conflict (bung_id, member_id) do nothing
      `;
            return res.status(200).json({ ok: true });
        }

        if (req.method === "DELETE") {
            const bung_id = Number(req.query.bung_id);
            const member_id = Number(req.query.member_id);

            if (!Number.isFinite(bung_id) || !Number.isFinite(member_id)) {
                return res.status(400).json({ error: "invalid_input", detail: "bung_id, member_id가 필요합니다." });
            }

            await sql`
        delete from bung_attendees
        where bung_id = ${bung_id} and member_id = ${member_id}
      `;
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
