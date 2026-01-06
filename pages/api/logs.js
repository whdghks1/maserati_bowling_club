import { sql } from "../../src/db";

function parseBalls(input) {
    if (!input || typeof input !== "string") return [];
    const items = input
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    // 중복 제거 (대소문자 무시로 통일하고 싶으면 아래 주석 해제)
    // const normalized = items.map((x) => x.toLowerCase());
    // return [...new Set(normalized)];

    return [...new Set(items)];
}

function buildStartDatetime(logDate, startTime) {
    // logDate: 'YYYY-MM-DD' 필수
    // startTime: 'HH:MM' optional. 없으면 22:00
    const time = startTime && startTime.trim() ? startTime.trim() : "22:00";
    // timezone은 DB에서 timestamptz로 처리됨. 우선 로컬 기준 문자열로 전달
    return `${logDate} ${time}:00`;
}

export default async function handler(req, res) {
    try {
        if (req.method === "POST") {
            const {
                display_name,
                log_date,       // 'YYYY-MM-DD' (필수)
                start_time,     // 'HH:MM' (옵션)
                center_name,
                pattern_id,     // (옵션) 숫자 or null
                memo,
                balls,          // "DNA, The Code"
                games           // [{game_no, score}, ...]
            } = req.body ?? {};

            if (!display_name || !log_date) {
                return res.status(400).json({ error: "display_name and log_date are required" });
            }

            const startDatetime = buildStartDatetime(log_date, start_time);
            const ballList = parseBalls(balls);

            // 1) user upsert (이름 unique)
            const userRows = await sql`
        insert into users (display_name)
        values (${display_name})
        on conflict (display_name) do update set display_name = excluded.display_name
        returning id
      `;
            const userId = userRows[0].id;

            // 2) daily_logs upsert: (user_id, log_date) 기준 덮어쓰기
            const logRows = await sql`
  insert into daily_logs (user_id, log_date, start_datetime, center_name, pattern_id, memo)
  values (
    ${userId},
    ${log_date}::date,
    ${startDatetime}::timestamptz,
    ${center_name ?? null},
    ${pattern_id ?? null},
    ${memo ?? null}
  )
  on conflict (user_id, log_date) do update set
    start_datetime = excluded.start_datetime,
    center_name = excluded.center_name,
    pattern_id = excluded.pattern_id,
    memo = excluded.memo
  returning id
`;

            const logId = logRows[0].id;

            // 3) balls 덮어쓰기
            await sql`delete from daily_balls where log_id = ${logId}`;
            for (const name of ballList) {
                await sql`
          insert into daily_balls (log_id, ball_name)
          values (${logId}, ${name})
          on conflict (log_id, ball_name) do nothing
        `;
            }

            // 4) games 덮어쓰기
            await sql`delete from games where log_id = ${logId}`;
            if (Array.isArray(games)) {
                for (const g of games) {
                    const gameNo = Number(g.game_no);
                    const score = Number(g.score);
                    if (!Number.isFinite(gameNo) || !Number.isFinite(score)) continue;
                    await sql`
            insert into games (log_id, game_no, score)
            values (${logId}, ${gameNo}, ${score})
          `;
                }
            }

            return res.status(200).json({ ok: true, log_id: logId });
        }

        if (req.method === "GET") {
            // /api/logs?name=홍길동&month=2026-01
            const { name, month } = req.query;
            if (!name || !month) return res.status(400).json({ error: "name and month are required" });

            const start = `${month}-01`;
            // 다음달 1일 계산을 JS로 안 하고 SQL에서 처리
            const rows = await sql`
        select
          d.id as log_id,
          d.log_date,
          d.start_datetime,
          d.center_name,
          d.memo,
          p.id as pattern_id,
          p.name as pattern_name,
          coalesce(
            (select json_agg(json_build_object('game_no', g.game_no, 'score', g.score) order by g.game_no)
             from games g where g.log_id = d.id),
            '[]'::json
          ) as games,
          coalesce(
            (select json_agg(b.ball_name order by b.ball_name)
             from daily_balls b where b.log_id = d.id),
            '[]'::json
          ) as balls
        from daily_logs d
        join users u on u.id = d.user_id
        left join patterns p on p.id = d.pattern_id
        where u.display_name = ${name}
          and d.log_date >= ${start}::date
          and d.log_date < (${start}::date + interval '1 month')::date
        order by d.log_date desc
      `;

            return res.status(200).json(rows);
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message ?? e) });
    }
}
