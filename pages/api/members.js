// pages/api/members.js
import { sql } from "../../src/db";

export default async function handler(req, res) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    try {
        const rows = await sql`
      select id, name
      from members
      order by name asc
    `;
        return res.status(200).json(rows);
    } catch (e) {
        return res.status(500).json({ error: "Server error", detail: String(e?.message ?? e) });
    }
}
