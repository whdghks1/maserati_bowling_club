// pages/regular-admin.js
import { useEffect, useMemo, useState } from "react";

function pad2(n) { return String(n).padStart(2, "0"); }
function ymdToday() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toNum(v) {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function EditableRow({ idx, row, loading, onSave }) {
    const [name, setName] = useState(row.name || "");
    const [g1, setG1] = useState(row.game1 ?? "");
    const [g2, setG2] = useState(row.game2 ?? "");
    const [g3, setG3] = useState(row.game3 ?? "");

    useEffect(() => {
        setName(row.name || "");
        setG1(row.game1 ?? "");
        setG2(row.game2 ?? "");
        setG3(row.game3 ?? "");
    }, [row]);

    return (
        <div className="tr">
            <div>{idx + 1}</div>

            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="inp r" value={g1} onChange={(e) => setG1(e.target.value)} />
            <input className="inp r" value={g2} onChange={(e) => setG2(e.target.value)} />
            <input className="inp r" value={g3} onChange={(e) => setG3(e.target.value)} />

            <div className="r b">{row.total_pins ?? ""}</div>
            <div className="r">{row.average ?? ""}</div>

            <button
                type="button"
                className="btn"
                disabled={loading}
                onClick={() => onSave({ name, game1: g1, game2: g2, game3: g3 })}
            >
                저장
            </button>

            <style jsx>{`
        .btn {
          border: 1px solid #ddd;
          background: white;
          border-radius: 10px;
          padding: 8px 10px;
          cursor: pointer;
          font-weight: 900;
        }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>
        </div>
    );
}

export default function RegularAdminPage() {
    const [season, setSeason] = useState(String(new Date().getFullYear()));

    // 회차 생성/수정 폼
    const [meetingNo, setMeetingNo] = useState("");
    const [meetingDate, setMeetingDate] = useState(ymdToday());

    // 회차 목록/선택
    const [meetings, setMeetings] = useState([]);
    const [selectedNo, setSelectedNo] = useState("");

    // 결과
    const [rows, setRows] = useState([]);
    const [newName, setNewName] = useState("");
    const [newG1, setNewG1] = useState("");
    const [newG2, setNewG2] = useState("");
    const [newG3, setNewG3] = useState("");

    // 상태
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");

    const seasonNum = useMemo(() => toNum(season), [season]);

    async function apiJson(url, options) {
        const res = await fetch(url, options);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.detail || json?.error || `HTTP ${res.status}`);
        return json;
    }

    async function loadMeetings() {
        if (!seasonNum) return;
        const data = await apiJson(`/api/regular-meetings?season=${seasonNum}`);
        setMeetings(Array.isArray(data) ? data : []);
    }

    async function loadResults(no) {
        if (!seasonNum || !no) return;
        const data = await apiJson(`/api/regular-results?season=${seasonNum}&meeting_no=${encodeURIComponent(no)}`);
        setRows(Array.isArray(data) ? data : []);
    }

    useEffect(() => {
        (async () => {
            try {
                setErr(""); setMsg("");
                setSelectedNo("");
                setRows([]);
                await loadMeetings();
            } catch (e) {
                setErr(String(e?.message ?? e));
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seasonNum]);

    async function saveMeeting() {
        setErr(""); setMsg("");
        try {
            const no = toNum(meetingNo);
            if (!seasonNum || !no || no <= 0) throw new Error("season/meeting_no 확인");
            setLoading(true);

            await apiJson("/api/regular-meetings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    season: seasonNum,
                    meeting_no: no,
                    meeting_date: meetingDate || null,
                }),
            });

            setMsg(`정기전 ${no}회차 저장 완료`);
            setMeetingNo("");
            await loadMeetings();
        } catch (e) {
            setErr(String(e?.message ?? e));
        } finally {
            setLoading(false);
        }
    }

    async function pickMeeting(no) {
        setSelectedNo(String(no));
        setErr(""); setMsg("");
        try {
            setLoading(true);
            await loadResults(String(no));
        } catch (e) {
            setErr(String(e?.message ?? e));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }

    async function upsertResult({ name, game1, game2, game3 }) {
        setErr(""); setMsg("");
        try {
            if (!seasonNum) throw new Error("season 확인");
            if (!selectedNo) throw new Error("회차 선택 필요");

            const nm = String(name || "").trim();
            const g1 = toNum(game1);
            const g2 = toNum(game2);
            const g3 = toNum(game3);

            if (!nm) throw new Error("이름 필요");
            if (g1 == null || g2 == null || g3 == null) throw new Error("G1~G3 점수 필요(0~300)");

            setLoading(true);

            await apiJson("/api/regular-results", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    season: seasonNum,
                    meeting_no: Number(selectedNo),
                    // meeting_date는 회차 생성에서만 관리해도 됨
                    name: nm,
                    game1: g1,
                    game2: g2,
                    game3: g3,
                }),
            });

            setMsg(`${nm} 저장 완료`);
            await loadResults(selectedNo);
        } catch (e) {
            setErr(String(e?.message ?? e));
        } finally {
            setLoading(false);
        }
    }

    async function addNew() {
        await upsertResult({ name: newName, game1: newG1, game2: newG2, game3: newG3 });
        setNewName(""); setNewG1(""); setNewG2(""); setNewG3("");
    }

    return (
        <div className="wrap">
            <h1 className="h1">정기전 관리자</h1>

            {(err || msg) && (
                <div className={`toast ${err ? "bad" : "ok"}`}>
                    {err ? `오류: ${err}` : msg}
                </div>
            )}

            <div className="layout">
                {/* LEFT */}
                <section className="card">
                    <div className="secTitle">회차 관리</div>

                    <label className="lab">시즌</label>
                    <input className="inp" value={season} onChange={(e) => setSeason(e.target.value)} />

                    <div className="gap" />

                    <label className="lab">회차 번호</label>
                    <input className="inp" value={meetingNo} onChange={(e) => setMeetingNo(e.target.value)} placeholder="예: 1" />

                    <label className="lab">날짜</label>
                    <input className="inp" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />

                    <button className="btnPrimary" type="button" disabled={loading} onClick={saveMeeting}>
                        회차 저장(생성/수정)
                    </button>

                    <div className="hr" />

                    <div className="secTitle" style={{ marginBottom: 8 }}>회차 선택</div>

                    <div className="meetList">
                        {meetings.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                className={`meetBtn ${String(m.meeting_no) === selectedNo ? "on" : ""}`}
                                onClick={() => pickMeeting(m.meeting_no)}
                            >
                                <span className="meetNo">{m.meeting_no}회차</span>
                                <span className="meetDate">{m.meeting_date ? String(m.meeting_date).slice(0, 10) : ""}</span>
                            </button>
                        ))}
                        {meetings.length === 0 && <div className="muted">회차가 없습니다.</div>}
                    </div>
                </section>

                {/* RIGHT */}
                <section className="card">
                    <div className="secTitle">
                        결과 입력/수정 (3게임)
                        {selectedNo ? <span className="pill"> {selectedNo}회차</span> : null}
                    </div>

                    {!selectedNo && <div className="muted">왼쪽에서 회차를 선택하세요.</div>}

                    {selectedNo && (
                        <>
                            {/* new row */}
                            <div className="newRow">
                                <input className="inp" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="이름" />
                                <input className="inp r" value={newG1} onChange={(e) => setNewG1(e.target.value)} placeholder="G1" />
                                <input className="inp r" value={newG2} onChange={(e) => setNewG2(e.target.value)} placeholder="G2" />
                                <input className="inp r" value={newG3} onChange={(e) => setNewG3(e.target.value)} placeholder="G3" />
                                <button className="btnPrimary" type="button" disabled={loading} onClick={addNew}>
                                    추가
                                </button>
                            </div>

                            <div className="tbl">
                                <div className="tr th">
                                    <div>#</div>
                                    <div>이름</div>
                                    <div className="r">G1</div>
                                    <div className="r">G2</div>
                                    <div className="r">G3</div>
                                    <div className="r">합</div>
                                    <div className="r">에버</div>
                                    <div />
                                </div>

                                {rows.map((r, idx) => (
                                    <EditableRow key={`${r.meeting_id}-${r.member_id}`} idx={idx} row={r} loading={loading} onSave={upsertResult} />
                                ))}

                                {loading && <div className="muted pad">불러오는 중...</div>}
                                {!loading && rows.length === 0 && <div className="muted pad">아직 결과가 없습니다.</div>}
                            </div>
                        </>
                    )}
                </section>
            </div>

            <style jsx>{`
                .wrap{
                    max-width: 980px;
                    margin: 0 auto;
                    padding: 16px;
                    font-family: system-ui, -apple-system, Segoe UI, Roboto;
                    color: #111;
                }
                .h1{
                    margin: 0 0 12px 0;
                    font-size: 22px;
                    font-weight: 900;
                    letter-spacing: -0.02em;
                }

                .toast{
                    border-radius: 14px;
                    padding: 10px 12px;
                    border: 1px solid #eee;
                    background: #fafafa;
                    margin-bottom: 12px;
                    font-weight: 800;
                }
                .toast.bad{ border-color:#f2c2c2; background:#fff5f5; color:#b00020; }
                .toast.ok{ border-color:#e6e6e6; background:#fafafa; }

                .layout{
                    display:grid;
                    grid-template-columns: 1fr;
                    gap: 12px;
                }
                @media (min-width: 980px){
                    .layout{ grid-template-columns: 360px 1fr; align-items:start; }
                }

                .card{
                    border: 1px solid #eee;
                    border-radius: 16px;
                    padding: 14px;
                    background: white;
                }

                .secTitle{
                    font-weight: 900;
                    margin-bottom: 12px;
                    display:flex;
                    align-items:center;
                    gap: 8px;
                }

                .pill{
                    border: 1px solid #e3e3e3;
                    border-radius: 999px;
                    padding: 4px 10px;
                    font-size: 12px;
                    color: #666;
                    font-weight: 900;
                    background: #fafafa;
                }

                .lab{
                    display:block;
                    font-size: 12px;
                    color:#666;
                    margin: 10px 0 6px;
                    font-weight: 800;
                }

                .inp{
                    width:100%;
                    border: 1px solid #ddd;
                    border-radius: 12px;
                    padding: 11px 12px;
                    font-size: 14px;
                    outline:none;
                    background:white;
                    color:#111;
                }
                .inp:focus{ border-color:#bdbdbd; }
                .r{ text-align:right; }

                .btnPrimary{
                    width:100%;
                    margin-top: 12px;
                    padding: 12px 12px;
                    border-radius: 14px;
                    border: 1px solid #111;
                    background: #111;
                    color: white;
                    font-weight: 900;
                    cursor:pointer;
                }
                .btnPrimary:disabled{ opacity:.6; cursor:not-allowed; }

                .hr{ margin: 14px 0; border-top: 1px solid #eee; }

                /* --- 회차 선택 --- */
                .meetList{ display:grid; gap: 8px; }
                .meetBtn{
                    width:100%;
                    display:flex;
                    justify-content: space-between;
                    align-items:center;
                    text-align:left;
                    padding: 12px 12px;
                    border-radius: 14px;
                    border: 1px solid #e6e6e6;
                    background: white;
                    cursor:pointer;
                    transition: background .1s ease, border-color .1s ease;
                }
                .meetBtn:hover{ background:#fafafa; border-color:#d6d6d6; }
                .meetBtn.on{ border-color:#111; background:#fff; }
                .meetNo{ font-weight: 900; }
                .meetDate{ font-size: 12px; color:#888; font-weight: 800; }

                /* --- 추가 입력 영역 (겹침 해결) --- */
                .newRow{
                    display:grid;
                    grid-template-columns: 1.2fr .6fr .6fr .6fr auto;
                    gap: 8px;
                    align-items: center;
                    margin-bottom: 12px;
                }
                .newRow .btnPrimary{
                    width: auto;           /* ✅ 버튼이 input 위로 안 올라감 */
                    margin-top: 0;
                    padding: 11px 14px;
                    border-radius: 12px;
                    white-space: nowrap;
                }

                /* 모바일: 2줄로 자연스럽게 */
                @media (max-width: 720px){
                    .newRow{
                    grid-template-columns: 1fr 1fr 1fr;
                    }
                    .newRow input:first-child{
                    grid-column: 1 / -1;
                    }
                    .newRow .btnPrimary{
                    grid-column: 1 / -1;
                    width: 100%;
                    }
                }

                /* --- 결과 표 --- */
                .tbl{
                    border: 1px solid #eee;
                    border-radius: 14px;
                    overflow: hidden;
                    background: white;
                }

                /* 표 전체를 가로 스크롤 가능하게 (모바일 필수) */
                .tbl :global(.tr){
                    min-width: 720px; /* ✅ 이걸로 모바일에서 표가 깨지지 않음 */
                }
                .tbl{
                    overflow-x: auto;
                }

                .tr{
                    display:grid;
                    grid-template-columns: 44px 1.2fr 70px 70px 70px 72px 72px 90px;
                    gap: 8px;
                    padding: 10px;
                    border-bottom: 1px solid #eee;
                    align-items:center;
                }

                .th{
                    background: #fafafa;
                    font-weight: 900;
                    position: sticky;
                    top: 0;
                    z-index: 2;
                }

                .muted{ color:#666; }
                .pad{ padding: 10px; }

                /* input들이 행 안에서 꽉 차도록 */
                .tr :global(input){
                    width: 100%;
                    border: 1px solid #ddd;
                    border-radius: 10px;
                    padding: 9px 10px;
                    font-size: 14px;
                    outline: none;
                }
                .tr :global(input:focus){ border-color:#bdbdbd; }

                /* 모바일 */
                @media (max-width: 480px){
                    .wrap{ padding: 12px; }
                    .card{ padding: 12px; border-radius: 14px; }
                }
                `}</style>

        </div>
    );
}
