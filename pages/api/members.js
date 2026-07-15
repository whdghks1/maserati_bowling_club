// pages/api/members.js
import { sql } from "../../src/db";

function calcLevel(average) {
    if (average == null || !Number.isFinite(average)) return null;
    if (average <= 120) return 1;
    if (average <= 140) return 2;
    if (average <= 150) return 3;
    if (average <= 160) return 4;
    if (average <= 170) return 5;
    if (average <= 180) return 6;
    if (average <= 190) return 7;
    if (average <= 200) return 8;
    if (average <= 210) return 9;
    if (average <= 220) return 10;
    return 11;
}

function serializeMember(row) {
    const gamesPlayed = Number(row.games_played || 0);
    const totalPins = Number(row.total_pins || 0);
    const average = gamesPlayed > 0 ? Number((totalPins / gamesPlayed).toFixed(1)) : null;

    return {
        id: row.id,
        name: row.name,
        is_active: row.is_active,
        games_played: gamesPlayed,
        total_pins: totalPins,
        average,
        level: calcLevel(average),
    };
}

async function updateMember({ id, name, isActive }) {
    const memberId = Number(id);
    if (!Number.isInteger(memberId) || memberId <= 0) {
        return { error: [400, "id가 올바르지 않습니다."] };
    }

    const nextName = name == null ? null : String(name).trim();
    if (name != null && !nextName) {
        return { error: [400, "이름을 입력해주세요."] };
    }
    if (nextName == null && isActive == null) {
        return { error: [400, "변경할 값이 없습니다."] };
    }

    const rows = await sql`
      update members
      set
        name = coalesce(${nextName}, name),
        is_active = coalesce(${isActive}::boolean, is_active)
      where id = ${memberId}
      returning id, name, is_active
    `;

    if (!rows[0]) return { error: [404, "멤버를 찾을 수 없습니다."] };
    return { member: rows[0] };
}

export default async function handler(req, res) {
    try {
        if (req.method === "GET") {
            const q = String(req.query.q || "").trim();
            const includeInactive = String(req.query.include_inactive || "") === "1";

            // level 컬럼을 별도로 저장하지 않고 실제 경기 기록으로 계산한다.
            const rows = await sql`
              select
                m.id,
                m.name,
                m.is_active,
                count(rg.score)::int as games_played,
                coalesce(sum(rg.score), 0)::int as total_pins
              from members m
              left join regular_games rg on rg.member_id = m.id
              where
                (${includeInactive}::boolean = true or m.is_active = true)
                and (${q} = '' or m.name ilike ${"%" + q + "%"})
              group by m.id, m.name, m.is_active
              order by m.is_active desc, m.name asc
            `;

            return res.status(200).json(rows.map(serializeMember));
        }

        if (req.method === "POST") {
            const name = String(req.body?.name || "").trim();
            if (!name) {
                return res.status(400).json({ error: "invalid_input", detail: "이름을 입력해주세요." });
            }

            const rows = await sql`
              insert into members (name, is_active)
              values (${name}, true)
              on conflict (name)
              do update set is_active = true
              returning id, name, is_active
            `;
            return res.status(200).json({ ok: true, member: rows[0] });
        }

        if (req.method === "PATCH" || req.method === "PUT") {
            const result = await updateMember({
                id: req.body?.id,
                name: req.body?.name,
                isActive: req.body?.is_active == null ? null : Boolean(req.body.is_active),
            });
            if (result.error) {
                const [status, detail] = result.error;
                return res.status(status).json({ error: "invalid_input", detail });
            }
            return res.status(200).json({ ok: true, member: result.member });
        }

        if (req.method === "DELETE") {
            // 과거 경기 기록 보존을 위해 실제 삭제 대신 비활성 처리한다.
            const result = await updateMember({
                id: req.query.id,
                name: null,
                isActive: false,
            });
            if (result.error) {
                const [status, detail] = result.error;
                return res.status(status).json({ error: "invalid_input", detail });
            }
            return res.status(200).json({ ok: true, member: result.member });
        }

        res.setHeader("Allow", ["GET", "POST", "PATCH", "PUT", "DELETE"]);
        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error(e);
        const message = String(e?.message ?? e);
        const isDuplicate = e?.code === "23505" || message.includes("duplicate key");
        if (isDuplicate) {
            return res.status(409).json({ error: "duplicate_name", detail: "이미 등록된 이름입니다." });
        }
        return res.status(500).json({ error: "Server error", detail: message });
    }
}
