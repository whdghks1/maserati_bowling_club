// pages/regular/[id].js
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

export default function RegularViewPage() {
    const router = useRouter();
    const id = router.query.id;

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [meeting, setMeeting] = useState(null);
    const [results, setResults] = useState([]);

    async function load() {
        if (!id) return;
        setErr("");
        setLoading(true);
        try {
            const res = await fetch(`/api/regular/meeting?id=${encodeURIComponent(id)}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `failed: ${res.status}`);
            setMeeting(json.meeting || null);
            setResults(Array.isArray(json.results) ? json.results : []);
        } catch (e) {
            setErr(String(e?.message || e));
            setMeeting(null);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, [id]);

    const title = useMemo(() => {
        if (!meeting) return "정기전 결과";
        return `정기전 ${meeting.meeting_no}회차`;
    }, [meeting]);

    return (
        <div className="wrap">
            <div className="top">
                <div>
                    <h1 className="h1">{title}</h1>
                    <div className="sub">{meeting?.meeting_date || ""} {meeting?.season != null ? `· 시즌 ${meeting.season}` : ""}</div>
                </div>
                <div className="right">
                    <Link href="/regular" className="btn">목록</Link>
                    <Link href="/regular-admin" className="btn">입력/수정</Link>
                </div>
            </div>

            {err && <div className="err">오류: {err}</div>}
            {loading && <div className="muted">불러오는 중...</div>}

            <div className="tableWrap">
                <div className="tr th">
                    <div>#</div>
                    <div>이름</div>
                    <div className="r">G1</div>
                    <div className="r">G2</div>
                    <div className="r">G3</div>
                    <div className="r">합계</div>
                    <div className="r">에버</div>
                </div>

                {results.map((r, idx) => (
                    <div key={r.member_id} className="tr">
                        <div>{idx + 1}</div>
                        <div className="name">{r.name}</div>
                        <div className="r">{r.game1 ?? ""}</div>
                        <div className="r">{r.game2 ?? ""}</div>
                        <div className="r">{r.game3 ?? ""}</div>
                        <div className="r">{r.total_pins}</div>
                        <div className="r">{r.average}</div>
                    </div>
                ))}
            </div>

            <style jsx>{`
        .wrap { max-width: 980px; margin: 0 auto; padding: 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto; }
        .top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
        .h1 { margin: 0; }
        .sub { color:#666; margin-top: 4px; }
        .right { display:flex; gap:8px; }
        .btn { border:1px solid #ddd; border-radius:12px; padding:10px 12px; text-decoration:none; color:#111; background:white; }
        .err { color:#b00020; margin: 10px 0; }
        .muted { color:#666; margin: 10px 0; }

        .tableWrap {
          margin-top: 12px;
          border: 1px solid #eee;
          border-radius: 16px;
          overflow: auto; /* 모바일 가로 스크롤 */
          background: white;
        }
        .tr {
          display: grid;
          grid-template-columns: 44px 1fr 54px 54px 54px 70px 70px;
          gap: 8px;
          padding: 10px;
          border-top: 1px solid #eee;
          align-items: center;
          min-width: 720px;
        }
        .th { border-top: none; background: #fafafa; font-weight: 900; position: sticky; top: 0; }
        .name { font-weight: 900; }
        .r { text-align: right; }

        @media (max-width: 480px) {
          .wrap { padding: 12px; }
        }
      `}</style>
        </div>
    );
}
