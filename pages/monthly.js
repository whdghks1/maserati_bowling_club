// pages/monthly.js
import { useMemo, useState } from "react";

function currentMonth() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
}

export default function MonthlyReportPage() {
    // 입력 폼 상태
    const [monthInput, setMonthInput] = useState(currentMonth());
    const [nameInput, setNameInput] = useState("");

    // 실제 조회에 쓰는 상태 (버튼 눌렀을 때만 갱신)
    const [month, setMonth] = useState(currentMonth());
    const [name, setName] = useState("");

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [data, setData] = useState(null);

    const queryUrl = useMemo(() => {
        const params = new URLSearchParams({ month });
        if (name.trim()) params.set("name", name.trim());
        return `/api/reports/monthly?${params.toString()}`;
    }, [month, name]);

    async function load(url) {
        setLoading(true);
        setErr("");
        try {
            const res = await fetch(url);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `Failed: ${res.status}`);
            setData(json);
        } catch (e) {
            setData(null);
            setErr(String(e?.message ?? e));
        } finally {
            setLoading(false);
        }
    }

    async function onSearch() {
        const m = monthInput.trim();
        const n = nameInput.trim();

        if (!m) {
            setErr("month를 입력해주세요. 예: 2026-01");
            return;
        }

        // ✅ 형식 검증 강화
        if (!/^\d{4}-\d{2}$/.test(m)) {
            setErr("month 형식은 YYYY-MM 입니다. 예: 2026-01");
            return;
        }

        // 검색 조건 확정
        setMonth(m);
        setName(n);

        // state 업데이트 타이밍 문제 피하려고 URL을 여기서 직접 만들어 호출
        const params = new URLSearchParams({ month: m });
        if (n) params.set("name", n);
        await load(`/api/reports/monthly?${params.toString()}`);
    }

    const s = data?.summary;

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
            <h1 style={{ marginBottom: 6 }}>월간 리포트</h1>
            <p style={{ marginTop: 0, color: "#666" }}>
                이름을 비우면 <b>전체(클럽)</b> 기준 집계. 조건 입력 후 <b>검색</b>을 눌러주세요.
            </p>

            <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>월 (YYYY-MM)</span>
                        <input
                            value={monthInput}
                            onChange={(e) => setMonthInput(e.target.value)}
                            placeholder="2026-01"
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                        />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>이름 (선택)</span>
                        <input
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            placeholder="예: 홍길동 (비우면 전체)"
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault(); // ✅ 중복 호출 방지
                                    onSearch();
                                }
                            }}
                        />
                    </label>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button
                        type="button"
                        onClick={onSearch}
                        disabled={loading}
                        style={{
                            padding: "12px 16px",
                            borderRadius: 10,
                            border: "1px solid #111",
                            background: loading ? "#ddd" : "#111",
                            color: loading ? "#333" : "white",
                            cursor: loading ? "not-allowed" : "pointer",
                            minWidth: 120,
                        }}
                    >
                        {loading ? "검색 중..." : "검색"}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setErr("");
                            setNameInput("");
                            // 월은 유지, 이름만 지우고 바로 전체 검색
                            const m = monthInput.trim() || currentMonth();

                            if (!/^\d{4}-\d{2}$/.test(m)) {
                                setErr("month 형식은 YYYY-MM 입니다. 예: 2026-01");
                                return;
                            }

                            setMonthInput(m);
                            setMonth(m);
                            setName("");
                            load(`/api/reports/monthly?month=${encodeURIComponent(m)}`);
                        }}
                        disabled={loading}
                        style={{
                            padding: "12px 16px",
                            borderRadius: 10,
                            border: "1px solid #ccc",
                            background: "white",
                            cursor: loading ? "not-allowed" : "pointer",
                        }}
                    >
                        전체 보기
                    </button>
                </div>

                <div style={{ marginTop: 10, color: "#666", fontSize: 13 }}>
                    현재 조회 URL: <code>{queryUrl}</code>
                </div>
            </section>

            {err && (
                <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5", borderRadius: 8, marginBottom: 12 }}>
                    오류: {err}
                </div>
            )}

            {!data && !err && <div style={{ color: "#666" }}>조건을 입력하고 검색을 눌러주세요.</div>}

            {data && (
                <>
                    <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10, marginBottom: 12 }}>
                        <h2 style={{ marginTop: 0, fontSize: 18 }}>요약</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                            <Card label="기록한 날짜 수" value={s?.total_days ?? 0} />
                            <Card label="총 게임 수" value={s?.total_games ?? 0} />
                            <Card label="평균 점수" value={s?.avg_score ?? "-"} />
                            <Card label="최고점" value={s?.max_score ?? "-"} />
                            <Card label="최저점" value={s?.min_score ?? "-"} />
                            <Card label="200+ 게임" value={`${s?.games_200_plus ?? 0}`} />
                        </div>
                    </section>

                    <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10, marginBottom: 12 }}>
                        <h2 style={{ marginTop: 0, fontSize: 18 }}>볼링공 TOP</h2>
                        {data.ballsTop?.length ? (
                            <SimpleTable
                                columns={["ball_name", "used_days"]}
                                rows={data.ballsTop}
                                headers={{ ball_name: "볼링공", used_days: "사용한 날 수" }}
                            />
                        ) : (
                            <div style={{ color: "#666" }}>데이터가 없어요.</div>
                        )}
                    </section>

                    <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10, marginBottom: 12 }}>
                        <h2 style={{ marginTop: 0, fontSize: 18 }}>패턴별</h2>
                        {data.byPattern?.length ? (
                            <SimpleTable
                                columns={["pattern_name", "days", "games", "avg_score", "max_score", "games_200_plus"]}
                                rows={data.byPattern}
                                headers={{
                                    pattern_name: "패턴",
                                    days: "일수",
                                    games: "게임",
                                    avg_score: "평균",
                                    max_score: "최고",
                                    games_200_plus: "200+",
                                }}
                            />
                        ) : (
                            <div style={{ color: "#666" }}>데이터가 없어요.</div>
                        )}
                    </section>

                    <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
                        <h2 style={{ marginTop: 0, fontSize: 18 }}>일자별</h2>
                        {data.daily?.length ? (
                            <SimpleTable
                                columns={["log_date", "games", "avg_score", "max_score"]}
                                rows={data.daily}
                                headers={{ log_date: "날짜", games: "게임", avg_score: "평균", max_score: "최고" }}
                            />
                        ) : (
                            <div style={{ color: "#666" }}>데이터가 없어요.</div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

function Card({ label, value }) {
    return (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10, background: "#fafafa" }}>
            <div style={{ color: "#666", fontSize: 13 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
        </div>
    );
}

function SimpleTable({ columns, rows, headers }) {
    return (
        <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th
                                key={c}
                                style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #eee", color: "#666", fontWeight: 600 }}
                            >
                                {headers?.[c] ?? c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, idx) => (
                        <tr key={idx}>
                            {columns.map((c) => (
                                <td key={c} style={{ padding: "8px 10px", borderBottom: "1px solid #f2f2f2" }}>
                                    {String(r?.[c] ?? "")}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
