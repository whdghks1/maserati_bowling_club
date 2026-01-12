// pages/api/members.js
import { sql } from "../../src/db";

function toInt(v, fallback = null) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function calcLevel(avg) {
    // 기준:
    // 50~120 → 1
    // 121~140 → 2
    // 141~150 → 3
    // 151~160 → 4
    // 161~170 → 5
    // 171~180 → 6
    // 181~190 → 7
    // 191~200 → 8
    // 201~210 → 9
    // 211~220 → 10
    // 221~230 → 11
    if (avg == null) return null;
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
        if (req.method === "GET") {
            const rows = await sql`
        select id, name, average, level, games_played, total_pins, created_at, updated_at
        from members
        order by level asc, average desc, name asc
      `;
            return res.status(200).json(rows);
        }

        if (req.method === "POST") {
            const body = req.body || {};
            const name = String(body.name ?? "").trim();
            const average = toInt(body.average, null);
            const games_played = toInt(body.games_played, 0);
            const total_pins = toInt(body.total_pins, 0);

            if (!name) return res.status(400).json({ error: "name is required" });
            if (!Number.isFinite(average)) return res.status(400).json({ error: "average must be number" });

            const level = calcLevel(average);

            const inserted = await sql`
        insert into members (name, average, level, games_played, total_pins)
        values (${name}, ${average}, ${level}, ${games_played}, ${total_pins})
        returning id
      `;

            return res.status(201).json({ ok: true, id: inserted?.[0]?.id });
        }

        if (req.method === "PUT") {
            const body = req.body || {};
            const id = toInt(body.id, null);
            if (!Number.isFinite(id)) return res.status(400).json({ error: "id is required" });

            const name = body.name != null ? String(body.name).trim() : null;
            const average = body.average != null ? toInt(body.average, null) : null;
            const games_played = body.games_played != null ? toInt(body.games_played, 0) : null;
            const total_pins = body.total_pins != null ? toInt(body.total_pins, 0) : null;

            if (name !== null && !name) return res.status(400).json({ error: "name cannot be empty" });
            if (average !== null && !Number.isFinite(average)) return res.status(400).json({ error: "average must be number" });

            const level = average !== null ? calcLevel(average) : null;

            await sql`
        update members
        set
          name = coalesce(${name}, name),
          average = coalesce(${average}, average),
          level = case when ${average} is null then level else ${level} end,
          games_played = coalesce(${games_played}, games_played),
          total_pins = coalesce(${total_pins}, total_pins)
        where id = ${id}
      `;

            return res.status(200).json({ ok: true });
        }

        if (req.method === "DELETE") {
            const id = toInt(req.query?.id, null);
            if (!Number.isFinite(id)) return res.status(400).json({ error: "id query is required" });

            await sql`delete from members where id = ${id}`;
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        const msg = String(e?.message ?? e);

        // unique 위반(이름 중복) 안내
        if (msg.toLowerCase().includes("duplicate key") || msg.toLowerCase().includes("unique")) {
            return res.status(409).json({ error: "duplicate name", detail: "같은 이름은 등록할 수 없습니다." });
        }

        return res.status(500).json({ error: "Server error", detail: msg });
    }
}
