// pages/api/reports/monthly.js
import { sql } from "../../../src/db";

export default async function handler(req, res) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const { month, name } = req.query; // month: 'YYYY-MM', name optional
    if (!month) return res.status(400).json({ error: "month is required (YYYY-MM)" });

    const start = `${month}-01`;
    const nameParam = (typeof name === "string" && name.trim()) ? name.trim() : null;

    try {
        // 1) 요약
        const summaryRows = await sql`
      with base_logs as (
        select d.id, d.user_id, d.log_date, d.pattern_id
        from daily_logs d
        join users u on u.id = d.user_id
        where d.log_date >= ${start}::date
          and d.log_date < (${start}::date + interval '1 month')::date
          and (${nameParam}::text is null or u.display_name = ${nameParam})
      )
      select
        (select count(*) from base_logs) as total_days,
        (select count(*) from games g join base_logs bl on bl.id = g.log_id) as total_games,
        (select round(avg(g.score)) from games g join base_logs bl on bl.id = g.log_id) as avg_score,
        (select max(g.score) from games g join base_logs bl on bl.id = g.log_id) as max_score,
        (select min(g.score) from games g join base_logs bl on bl.id = g.log_id) as min_score,
        (select count(*) from games g join base_logs bl on bl.id = g.log_id where g.score >= 200) as games_200_plus
    `;
        const summary = summaryRows[0];

        // 2) 볼링공 TOP
        const ballsTop = await sql`
      with base_logs as (
        select d.id
        from daily_logs d
        join users u on u.id = d.user_id
        where d.log_date >= ${start}::date
          and d.log_date < (${start}::date + interval '1 month')::date
          and (${nameParam}::text is null or u.display_name = ${nameParam})
      )
      select
        b.ball_name,
        count(*) as used_days
      from daily_balls b
      join base_logs bl on bl.id = b.log_id
      group by b.ball_name
      order by used_days desc, b.ball_name asc
      limit 10
    `;

        // 3) 패턴별
        const byPattern = await sql`
      with base_logs as (
        select d.id, d.pattern_id
        from daily_logs d
        join users u on u.id = d.user_id
        where d.log_date >= ${start}::date
          and d.log_date < (${start}::date + interval '1 month')::date
          and (${nameParam}::text is null or u.display_name = ${nameParam})
      )
      select
        coalesce(p.name, '(미선택)') as pattern_name,
        count(distinct bl.id) as days,
        count(g.id) as games,
        round(avg(g.score)) as avg_score,
        max(g.score) as max_score,
        sum(case when g.score >= 200 then 1 else 0 end) as games_200_plus
      from base_logs bl
      left join patterns p on p.id = bl.pattern_id
      left join games g on g.log_id = bl.id
      group by pattern_name
      order by games desc, pattern_name asc
      limit 20
    `;

        // 4) 일자별
        const daily = await sql`
      with base_logs as (
        select d.id, d.log_date
        from daily_logs d
        join users u on u.id = d.user_id
        where d.log_date >= ${start}::date
          and d.log_date < (${start}::date + interval '1 month')::date
          and (${nameParam}::text is null or u.display_name = ${nameParam})
      )
      select
        bl.log_date,
        count(g.id) as games,
        round(avg(g.score)) as avg_score,
        max(g.score) as max_score
      from base_logs bl
      left join games g on g.log_id = bl.id
      group by bl.log_date
      order by bl.log_date desc
    `;

        return res.status(200).json({
            month,
            name: nameParam,
            summary,
            ballsTop,
            byPattern,
            daily,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message ?? e) });
    }
}
