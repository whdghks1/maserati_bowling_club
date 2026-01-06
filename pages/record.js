// pages/record.js
import { useEffect, useMemo, useState } from "react";

function todayKSTDateString() {
    // YYYY-MM-DD (로컬 기준)
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function sanitizeGames(games) {
    // keep valid rows only, game_no auto by index if missing
    return games
        .map((g, idx) => {
            const game_no = Number(g.game_no ?? idx + 1);
            const score = g.score === "" || g.score == null ? NaN : Number(g.score);
            return { game_no, score };
        })
        .filter((g) => Number.isFinite(g.game_no) && Number.isFinite(g.score));
}

function ballsPreview(ballsStr) {
    if (!ballsStr) return [];
    return [...new Set(ballsStr.split(",").map((s) => s.trim()).filter(Boolean))];
}

export default function RecordPage() {
    const [patterns, setPatterns] = useState([]);
    const [patternsLoading, setPatternsLoading] = useState(true);
    const [patternsError, setPatternsError] = useState("");

    const [displayName, setDisplayName] = useState("");
    const [logDate, setLogDate] = useState(todayKSTDateString());
    const [startTime, setStartTime] = useState(""); // optional; server defaults to 22:00
    const [centerName, setCenterName] = useState("");
    const [patternId, setPatternId] = useState(""); // string for select; send number or null
    const [memo, setMemo] = useState("");
    const [balls, setBalls] = useState("");

    const [games, setGames] = useState([
        { game_no: 1, score: "" },
        { game_no: 2, score: "" },
        { game_no: 3, score: "" },
    ]);

    const [saving, setSaving] = useState(false);
    const [saveOkMsg, setSaveOkMsg] = useState("");
    const [saveErrMsg, setSaveErrMsg] = useState("");

    const ballChips = useMemo(() => ballsPreview(balls), [balls]);

    useEffect(() => {
        // Restore last used name
        try {
            const last = localStorage.getItem("bowling:lastDisplayName");
            if (last && !displayName) setDisplayName(last);
        } catch { }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadPatterns() {
            setPatternsLoading(true);
            setPatternsError("");
            try {
                const res = await fetch("/api/patterns");
                if (!res.ok) throw new Error(`patterns fetch failed: ${res.status}`);
                const data = await res.json();
                if (!cancelled) setPatterns(Array.isArray(data) ? data : []);
            } catch (e) {
                if (!cancelled) setPatternsError(String(e?.message ?? e));
            } finally {
                if (!cancelled) setPatternsLoading(false);
            }
        }

        loadPatterns();
        return () => {
            cancelled = true;
        };
    }, []);

    function addGame() {
        setGames((prev) => [
            ...prev,
            { game_no: prev.length + 1, score: "" },
        ]);
    }

    function removeLastGame() {
        setGames((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    }

    function updateGameScore(idx, value) {
        setGames((prev) => prev.map((g, i) => (i === idx ? { ...g, score: value } : g)));
    }

    async function onSave() {
        setSaveOkMsg("");
        setSaveErrMsg("");

        const name = displayName.trim();
        if (!name) {
            setSaveErrMsg("이름을 입력해주세요.");
            return;
        }
        if (!logDate) {
            setSaveErrMsg("날짜를 선택해주세요.");
            return;
        }

        const payload = {
            display_name: name,
            log_date: logDate,            // 'YYYY-MM-DD'
            start_time: startTime || "",  // ''이면 서버에서 22:00 처리
            center_name: centerName.trim() || null,
            pattern_id: patternId ? Number(patternId) : null,
            memo: memo.trim() || null,
            balls: balls || "",
            games: sanitizeGames(games).map((g, idx) => ({
                game_no: idx + 1,
                score: g.score,
            })),
        };

        // 최소 1게임 점수는 권장 (원하면 필수로 바꿀 수 있음)
        if (payload.games.length === 0) {
            setSaveErrMsg("점수를 최소 1게임 이상 입력해주세요.");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.detail || data?.error || `save failed: ${res.status}`);
            }

            // remember name for next time
            try {
                localStorage.setItem("bowling:lastDisplayName", name);
            } catch { }

            setSaveOkMsg(`저장 완료! (log_id: ${data?.log_id ?? "?"})`);
        } catch (e) {
            setSaveErrMsg(String(e?.message ?? e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{ maxWidth: 780, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
            <h1 style={{ marginBottom: 8 }}>볼링 기록 입력</h1>
            <p style={{ marginTop: 0, color: "#666" }}>
                이름 기준으로 저장되며, 같은 날짜는 <b>덮어쓰기</b> 됩니다. 시간은 미입력 시 <b>22:00</b>으로 저장됩니다.
            </p>

            {/* Alerts */}
            {patternsError && (
                <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5", borderRadius: 8, marginBottom: 12 }}>
                    패턴 불러오기 실패: {patternsError}
                </div>
            )}
            {saveErrMsg && (
                <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5", borderRadius: 8, marginBottom: 12 }}>
                    저장 실패: {saveErrMsg}
                </div>
            )}
            {saveOkMsg && (
                <div style={{ padding: 12, border: "1px solid #c7f2c2", background: "#f5fff5", borderRadius: 8, marginBottom: 12 }}>
                    {saveOkMsg}
                </div>
            )}

            {/* Basic fields */}
            <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>이름 (중복 금지)</span>
                        <input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="예: 종환"
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                        />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>날짜</span>
                        <input
                            type="date"
                            value={logDate}
                            onChange={(e) => setLogDate(e.target.value)}
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                        />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>시작 시간 (옵션)</span>
                        <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                        />
                        <small style={{ color: "#666" }}>비우면 22:00으로 저장</small>
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>볼링장</span>
                        <input
                            value={centerName}
                            onChange={(e) => setCenterName(e.target.value)}
                            placeholder="예: OO볼링장"
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                        />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / span 2" }}>
                        <span>패턴 (선택)</span>
                        <select
                            value={patternId}
                            onChange={(e) => setPatternId(e.target.value)}
                            disabled={patternsLoading}
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                        >
                            <option value="">{patternsLoading ? "불러오는 중..." : "선택 안 함"}</option>
                            {patterns.map((p) => (
                                <option key={p.id} value={String(p.id)}>
                                    {p.name}{p.length_ft ? ` (${p.length_ft}ft)` : ""}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / span 2" }}>
                        <span>사용한 볼링공 (쉼표로 구분)</span>
                        <input
                            value={balls}
                            onChange={(e) => setBalls(e.target.value)}
                            placeholder="예: DNA, The Code, Summit"
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                        />
                        {ballChips.length > 0 && (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                                {ballChips.map((b) => (
                                    <span key={b} style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid #ddd", background: "#fafafa" }}>
                                        {b}
                                    </span>
                                ))}
                            </div>
                        )}
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / span 2" }}>
                        <span>메모</span>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            placeholder="예: 후반에 미끄러움 / 스페어 라인 유효"
                            rows={3}
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc", resize: "vertical" }}
                        />
                    </label>
                </div>
            </section>

            {/* Games */}
            <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <h2 style={{ margin: 0, fontSize: 18 }}>점수</h2>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={addGame} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "white" }}>
                            + 게임 추가
                        </button>
                        <button
                            type="button"
                            onClick={removeLastGame}
                            disabled={games.length <= 1}
                            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "white", opacity: games.length <= 1 ? 0.5 : 1 }}
                        >
                            - 마지막 삭제
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "center" }}>
                    {games.map((g, idx) => (
                        <div key={idx} style={{ display: "contents" }}>
                            <div style={{ color: "#444" }}>{idx + 1} 게임</div>
                            <input
                                inputMode="numeric"
                                value={g.score}
                                onChange={(e) => updateGameScore(idx, e.target.value)}
                                placeholder="0~300"
                                style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                            />
                        </div>
                    ))}
                </div>

                <small style={{ display: "block", marginTop: 10, color: "#666" }}>
                    점수는 숫자만 저장됩니다. (0~300)
                </small>
            </section>

            {/* Save */}
            <div style={{ display: "flex", gap: 10 }}>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    style={{
                        padding: "12px 16px",
                        borderRadius: 10,
                        border: "1px solid #111",
                        background: saving ? "#ddd" : "#111",
                        color: saving ? "#333" : "white",
                        cursor: saving ? "not-allowed" : "pointer",
                        minWidth: 140,
                    }}
                >
                    {saving ? "저장 중..." : "저장"}
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSaveOkMsg("");
                        setSaveErrMsg("");
                    }}
                    style={{
                        padding: "12px 16px",
                        borderRadius: 10,
                        border: "1px solid #ccc",
                        background: "white",
                        cursor: "pointer",
                    }}
                >
                    메시지 지우기
                </button>
            </div>

            <div style={{ marginTop: 16, color: "#666", fontSize: 13 }}>
                <div>테스트 팁: 터미널에서 <code>npx netlify dev</code> 실행 후 이 페이지 접속</div>
                <div>저장된 기록은 <code>/api/logs?name=이름&month=YYYY-MM</code> 로 조회 가능</div>
            </div>
        </div>
    );
}
