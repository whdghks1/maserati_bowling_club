import { sql } from "../../src/db";

export default async function handler(req, res) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const rows = await sql`
    select id, name, length_ft, note
    from patterns
    order by name asc
  `;

    return res.status(200).json(rows);
}
