// pages/regular/index.js
import Link from "next/link";
import { useEffect, useState } from "react";

export default function RegularListPage() {
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [meetings, setMeetings] = useState([]);

    async function load() {
        setErr("");
        setLoading(true);
        try {
            const res = await fetch("/api/regular/meetings?limit=300");
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `failed: ${res.status}`);
            setMeetings(Array.isArray(json.meetings) ? json.meetings : []);
        } catch (e) {
            setErr(String(e?.message || e));
            setMeetings([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    return (
        <div className="wrap">
            <div className="top">
                <h1 className="h1">정기전 결과</h1>
                <Link href="/regular-admin" className="btn">입력/수정</Link>
            </div>

            {err && <div className="err">오류: {err}</div>}
            {loading && <div className="muted">불러오는 중...</div>}

            <div className="list">
                {meetings.map((m) => (
                    <Link key={m.meeting_id} href={`/regular/${m.meeting_id}`} className="card">
                        <div className="title">
                            정기전 {m.meeting_no}회차
                            <span className="date">{m.meeting_date || "-"}</span>
                        </div>
                        <div className="meta">
                            시즌 {m.season ?? "-"} · 참가 {m.participant_count}명 · 입력완료 {m.complete_count}명
                        </div>
                    </Link>
                ))}
                {!loading && meetings.length === 0 && <div className="muted">정기전 데이터가 없습니다.</div>}
            </div>

            <style jsx>{`
        .wrap { max-width: 980px; margin: 0 auto; padding: 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto; }
        .top { display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .h1 { margin: 0; }
        .btn { border:1px solid #ddd; border-radius:12px; padding:10px 12px; text-decoration:none; color:#111; background:white; }
        .err { color:#b00020; margin: 10px 0; }
        .muted { color:#666; margin: 10px 0; }
        .list { display:grid; gap:10px; margin-top: 12px; }
        .card { border:1px solid #eee; border-radius:16px; padding:12px; background:white; text-decoration:none; color:#111; }
        .title { font-weight:900; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; }
        .date { color:#666; font-weight:700; }
        .meta { margin-top:6px; color:#666; font-size: 13px; }
      `}</style>
        </div>
    );
}
