// pages/api/reports/bungs/ranking.js
import { sql } from "../../../../src/db";

function asDateOnly(iso) {
    if (!iso) return null;
    return String(iso).slice(0, 10); // "YYYY-MM-DD"
}

export default async function handler(req, res) {
    try {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

        const fromIso = req.query.from ? String(req.query.from) : null;
        const toIso = req.query.to ? String(req.query.to) : null;

        // 날짜 비교는 date로만(키 꼬임 방지)
        const fromDate = asDateOnly(fromIso);
        const toDate = asDateOnly(toIso);

        const rows = await sql`
      with rng as (
        select
          ${fromDate}::date as from_date,
          ${toDate}::date as to_date
      ),

      -- 1) 벙별 참석자 수(유효 벙 판정용)
      bung_counts as (
        select
          b.id as bung_id,
          (b.bung_at at time zone 'Asia/Seoul')::date as bung_date,
          count(ba.id)::int as attendee_count
        from bungs b
        left join bung_attendees ba on ba.bung_id = b.id
        group by b.id
      ),

      -- 2) 유효 벙(4+)만 남기고 범위 필터까지 적용
      valid_bungs as (
        select
          bc.bung_id,
          bc.bung_date
        from bung_counts bc
        cross join rng
        where bc.attendee_count >= 4
          and (rng.from_date is null or bc.bung_date >= rng.from_date)
          and (rng.to_date   is null or bc.bung_date <= rng.to_date)
      ),

      -- 3) 유효 벙 참여 횟수(하루 2번이면 2번 인정: bung_id 단위로 카운트)
      valid_bung_part as (
        select
          ba.member_id,
          count(*)::int as valid_count
        from bung_attendees ba
        join valid_bungs vb on vb.bung_id = ba.bung_id
        group by ba.member_id
      ),

      -- 4) 정기전 참여 횟수(regular_results에 있으면 참가)
      regular_part as (
        select
          rr.member_id,
          count(*)::int as regular_count
        from regular_results rr
        join regular_meetings rm on rm.id = rr.meeting_id
        cross join rng
        where rm.meeting_date is not null
          and (rng.from_date is null or rm.meeting_date::date >= rng.from_date)
          and (rng.to_date   is null or rm.meeting_date::date <= rng.to_date)
        group by rr.member_id
      )

      select
        m.id as member_id,
        m.name,
        coalesce(vbp.valid_count, 0) as valid_count,
        coalesce(rp.regular_count, 0) as regular_count,
        (coalesce(vbp.valid_count, 0) + coalesce(rp.regular_count, 0))::int as total_count
      from members m
      left join valid_bung_part vbp on vbp.member_id = m.id
      left join regular_part rp on rp.member_id = m.id
      where (coalesce(vbp.valid_count,0) + coalesce(rp.regular_count,0)) > 0
      order by total_count desc, valid_count desc, regular_count desc, m.name asc
    `;

        // 🔹 summary 계산 (벙 개수 기준)
        const summaryRows = await sql`
        with rng as (
            select
            ${fromDate}::date as from_date,
            ${toDate}::date as to_date
        ),

        -- 유효 벙 개수
        valid_bung_cnt as (
            select count(*)::int as cnt
            from (
            select
                b.id
            from bungs b
            join bung_attendees ba on ba.bung_id = b.id
            cross join rng
            where
                (rng.from_date is null or (b.bung_at at time zone 'Asia/Seoul')::date >= rng.from_date)
                and (rng.to_date   is null or (b.bung_at at time zone 'Asia/Seoul')::date <= rng.to_date)
            group by b.id
            having count(ba.id) >= 4
            ) t
        ),

        -- 정기전 개수
        regular_cnt as (
            select count(*)::int as cnt
            from regular_meetings rm
            cross join rng
            where
            rm.meeting_date is not null
            and (rng.from_date is null or rm.meeting_date::date >= rng.from_date)
            and (rng.to_date   is null or rm.meeting_date::date <= rng.to_date)
        )

        select
            (select cnt from valid_bung_cnt) as valid_bungs,
            (select cnt from regular_cnt) as regular_meetings
        `;


        const summary = {
            valid_bungs: summaryRows[0]?.valid_bungs ?? 0,
            regular_meetings: summaryRows[0]?.regular_meetings ?? 0,
            total_bungs:
                (summaryRows[0]?.valid_bungs ?? 0) +
                (summaryRows[0]?.regular_meetings ?? 0),
        };

        return res.status(200).json({
            summary,
            rankings: rows,
        });

    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
    }
}
