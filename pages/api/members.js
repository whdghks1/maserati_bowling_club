// pages/api/members.js
import { sql } from "../../src/db";

export default async function handler(req, res) {
    try {
        // -------------------------
        // GET: 목록(검색/비활성 포함 옵션)
        // -------------------------
        if (req.method === "GET") {
            const q = String(req.query.q || "").trim();
            const includeInactive = String(req.query.include_inactive || "") === "1";

            const rows = await sql`
        select id, name, is_active
        from members
        where
          (${includeInactive}::boolean = true or is_active = true)
          and (${q} = '' or name ilike ${"%" + q + "%"})
        order by is_active desc, name asc
      `;
            return res.status(200).json(rows);
        }

        // -------------------------
        // POST: 멤버 추가
        // -------------------------
        if (req.method === "POST") {
            const name = String(req.body?.name || "").trim();
            if (!name) return res.status(400).json({ error: "invalid_input", detail: "name이 필요합니다." });

            // name unique인 상태를 유지한다면(현재 regular-results에서 upsert가 name 기준이라면)
            // 중복이면 기존 row 반환 + 활성화만 시키는게 운영에 편함
            const rows = await sql`
        insert into members (name, is_active)
        values (${name}, true)
        on conflict (name)
        do update set is_active = true
        returning id, name, is_active
      `;
            return res.status(200).json({ ok: true, member: rows[0] });
        }

        // -------------------------
        // PATCH: 이름 변경 / 활성 토글
        // -------------------------
        if (req.method === "PATCH") {
            const id = String(req.body?.id || "").trim();
            if (!id) return res.status(400).json({ error: "invalid_input", detail: "id가 필요합니다." });

            const nameRaw = req.body?.name;
            const isActiveRaw = req.body?.is_active;

            const name = nameRaw == null ? null : String(nameRaw).trim();
            const is_active =
                isActiveRaw == null ? null : Boolean(isActiveRaw);

            // 변경값 없으면 에러
            if (name == null && is_active == null) {
                return res.status(400).json({ error: "invalid_input", detail: "name 또는 is_active 중 하나는 필요합니다." });
            }

            const rows = await sql`
        update members
        set
          name = coalesce(${name}, name),
          is_active = coalesce(${is_active}::boolean, is_active)
        where id = ${id}
        returning id, name, is_active
      `;
            if (!rows[0]) return res.status(404).json({ error: "not_found", detail: "멤버를 찾을 수 없습니다." });

            return res.status(200).json({ ok: true, member: rows[0] });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message ?? e) });
    }
}
