// pages/regular-admin.js
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

function round1(n) { return Math.round(n * 10) / 10; }
function safeNum(v) {
    if (v === "" || v == null) return "";
    const n = Number(v);
    return Number.isFinite(n) ? n : "";
}

export default function RegularAdminPage() {
    const [err, setErr] = useState("");
    const [loadingMeetings, setLoadingMeetings] = useState(false);
    const [meetings, setMeetings] = useState([]);
    const [selectedMeetingId, setSelectedMeetingId] = useState("");

    const [members, setMembers] = useState([]);
    const [memberSearch, setMemberSearch] = useState("");

    const [loadingMeeting, setLoadingMeeting] = useState(false);
    const [meeting, setMeeting] = useState(null);
    const [rows, setRows] = useState([]); // {member_id,name,game1,game2,game3,total,avg}
    const [statusByMember, setStatusByMember] = useState({}); // member_id -> "idle|saving|saved|error"

    const timersRef = useRef(new Map()); // member_id -> timeout

    async function loadMeetings() {
        setErr("");
        setLoadingMeetings(true);
        try {
            const res = await fetch("/api/regular/meetings?limit=300");
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `meetings failed: ${res.status}`);
            const list = Array.isArray(json.meetings) ? json.meetings : [];
            setMeetings(list);
            if (!selectedMeetingId && list[0]?.meeting_id) setSelectedMeetingId(String(list[0].meeting_id));
        } catch (e) {
            setErr(String(e?.message || e));
            setMeetings([]);
        } finally {
            setLoadingMeetings(false);
        }
    }

    async function loadMembers() {
        try {
            const res = await fetch("/api/members");
            const json = await res.json().catch(() => []);
            if (!res.ok) throw new Error(json?.detail || json?.error || `members failed: ${res.status}`);
            setMembers(Array.isArray(json) ? json : []);
        } catch (e) {
            // 멤버 실패는 치명적이니 에러에 합침
            setErr((p) => (p ? `${p}\n${String(e?.message || e)}` : String(e?.message || e)));
            setMembers([]);
        }
    }

    async function loadMeeting(meetingId) {
        if (!meetingId) return;
        setErr("");
        setLoadingMeeting(true);
        try {
            const res = await fetch(`/api/regular/meeting?id=${encodeURIComponent(meetingId)}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `meeting failed: ${res.status}`);

            setMeeting(json.meeting || null);

            const list = Array.isArray(json.results) ? json.results : [];
            const mapped = list.map((r) => {
                const g1 = r.game1 ?? "";
                const g2 = r.game2 ?? "";
                const g3 = r.game3 ?? "";
                const total = (Number(g1) || 0) + (Number(g2) || 0) + (Number(g3) || 0);
                const avg = round1(total / 3);
                return { member_id: r.member_id, name: r.name, game1: g1, game2: g2, game3: g3, total, avg };
            });

            // 입력 페이지는 이름순이 편해서 정렬(원하면 에버순으로 바꿔도 됨)
            mapped.sort((a, b) => a.name.localeCompare(b.name, "ko"));

            setRows(mapped);
            setStatusByMember({});
        } catch (e) {
            setErr(String(e?.message || e));
            setMeeting(null);
            setRows([]);
            setStatusByMember({});
        } finally {
            setLoadingMeeting(false);
        }
    }

    useEffect(() => { loadMembers(); loadMeetings(); }, []);
    useEffect(() => { if (selectedMeetingId) loadMeeting(selectedMeetingId); }, [selectedMeetingId]);

    const pickedMemberIds = useMemo(() => new Set(rows.map((r) => r.member_id)), [rows]);

    const availableMembers = useMemo(() => {
        const q = memberSearch.trim();
        const base = members.filter((m) => !pickedMemberIds.has(m.id));
        if (!q) return base;
        return base.filter((m) => String(m.name || "").includes(q));
    }, [members, pickedMemberIds, memberSearch]);

    async function addParticipant(memberId) {
        if (!selectedMeetingId) return;
        setErr("");
        try {
            const res = await fetch("/api/regular/participants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ meeting_id: Number(selectedMeetingId), member_id: memberId }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `add failed: ${res.status}`);
            setMemberSearch("");
            await loadMeeting(selectedMeetingId);
            await loadMeetings();
        } catch (e) {
            setErr(String(e?.message || e));
        }
    }

    async function removeParticipant(memberId) {
        if (!selectedMeetingId) return;
        if (!confirm("참가자를 삭제할까요? (입력한 게임 점수도 같이 삭제됩니다)")) return;
        setErr("");
        try {
            const res = await fetch(`/api/regular/participants?meeting_id=${encodeURIComponent(selectedMeetingId)}&member_id=${memberId}`, {
                method: "DELETE",
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `remove failed: ${res.status}`);
            await loadMeeting(selectedMeetingId);
            await loadMeetings();
        } catch (e) {
            setErr(String(e?.message || e));
        }
    }

    function scheduleSave(memberId, nextRow) {
        // debounce: 450ms
        const timers = timersRef.current;
        if (timers.has(memberId)) clearTimeout(timers.get(memberId));

        setStatusByMember((p) => ({ ...p, [memberId]: "saving" }));

        const t = setTimeout(async () => {
            try {
                const res = await fetch("/api/regular/games", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        meeting_id: Number(selectedMeetingId),
                        member_id: memberId,
                        game1: nextRow.game1 === "" ? null : Number(nextRow.game1),
                        game2: nextRow.game2 === "" ? null : Number(nextRow.game2),
                        game3: nextRow.game3 === "" ? null : Number(nextRow.game3),
                    }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json?.detail || json?.error || `save failed: ${res.status}`);

                setStatusByMember((p) => ({ ...p, [memberId]: "saved" }));
                // 저장 후 1.2초 뒤 idle로
                setTimeout(() => setStatusByMember((p) => ({ ...p, [memberId]: "idle" })), 1200);
            } catch (e) {
                setStatusByMember((p) => ({ ...p, [memberId]: "error" }));
                setErr(String(e?.message || e));
            }
        }, 450);

        timers.set(memberId, t);
    }

    function updateScore(memberId, key, value) {
        setRows((prev) => {
            const next = prev.map((r) => {
                if (r.member_id !== memberId) return r;
                const v = value === "" ? "" : String(Math.max(0, Math.min(300, Number(value))));
                const game1 = key === "game1" ? v : r.game1;
                const game2 = key === "game2" ? v : r.game2;
                const game3 = key === "game3" ? v : r.game3;
                const total = (Number(game1) || 0) + (Number(game2) || 0) + (Number(game3) || 0);
                const avg = round1(total / 3);
                const nr = { ...r, [key]: v, game1, game2, game3, total, avg };
                scheduleSave(memberId, nr);
                return nr;
            });
            return next;
        });
    }

    return (
        <div className="wrap">
            <div className="top">
                <h1 className="h1">정기전 입력/수정</h1>
                <div className="right">
                    <Link className="btn" href="/regular">결과 보기</Link>
                </div>
            </div>

            {err && <div className="err">오류: {err}</div>}

            <div className="bar card">
                <label className="label">
                    <span>회차 선택</span>
                    <select
                        value={selectedMeetingId}
                        onChange={(e) => setSelectedMeetingId(e.target.value)}
                        className="select"
                    >
                        {meetings.map((m) => (
                            <option key={m.meeting_id} value={m.meeting_id}>
                                {m.meeting_date || "-"} · 정기전 {m.meeting_no}회차 · 참가 {m.participant_count}명
                            </option>
                        ))}
                    </select>
                </label>

                <button className="btn2" type="button" onClick={() => loadMeeting(selectedMeetingId)} disabled={loadingMeeting}>
                    {loadingMeeting ? "불러오는 중..." : "새로고침"}
                </button>
            </div>

            <div className="layout">
                <section className="card">
                    <div className="secTitle">참가자 추가</div>

                    <input
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="멤버 검색 (예: 종환)"
                        className="input"
                    />

                    <div className="picker">
                        {availableMembers.length === 0 ? (
                            <div className="muted">추가할 멤버가 없습니다.</div>
                        ) : (
                            availableMembers.slice(0, 30).map((m) => (
                                <button key={m.id} type="button" className="pickBtn" onClick={() => addParticipant(m.id)}>
                                    + {m.name}
                                </button>
                            ))
                        )}
                    </div>

                    <div className="hint">
                        점수는 입력 즉시 자동 저장됩니다. (수정도 동일)
                    </div>
                </section>

                <section className="card">
                    <div className="secTitle">
                        점수 입력 (3게임)
                        <span className="mini">
                            {meeting ? ` · ${meeting.meeting_date || "-"} · 정기전 ${meeting.meeting_no}회차` : ""}
                        </span>
                    </div>

                    {loadingMeetings && <div className="muted">회차 불러오는 중...</div>}
                    {loadingMeeting && <div className="muted">회차 데이터 불러오는 중...</div>}

                    <div className="grid">
                        {rows.map((r) => {
                            const st = statusByMember[r.member_id] || "idle";
                            return (
                                <div key={r.member_id} className="rowCard">
                                    <div className="rowTop">
                                        <div className="name">{r.name}</div>
                                        <div className={`status ${st}`}>
                                            {st === "saving" ? "저장중…" : st === "saved" ? "저장됨" : st === "error" ? "저장실패" : ""}
                                        </div>
                                        <button className="del" type="button" onClick={() => removeParticipant(r.member_id)}>삭제</button>
                                    </div>

                                    <div className="inputs">
                                        <label className="g">
                                            <span>G1</span>
                                            <input
                                                value={safeNum(r.game1)}
                                                onChange={(e) => updateScore(r.member_id, "game1", e.target.value)}
                                                inputMode="numeric"
                                                className="score"
                                            />
                                        </label>

                                        <label className="g">
                                            <span>G2</span>
                                            <input
                                                value={safeNum(r.game2)}
                                                onChange={(e) => updateScore(r.member_id, "game2", e.target.value)}
                                                inputMode="numeric"
                                                className="score"
                                            />
                                        </label>

                                        <label className="g">
                                            <span>G3</span>
                                            <input
                                                value={safeNum(r.game3)}
                                                onChange={(e) => updateScore(r.member_id, "game3", e.target.value)}
                                                inputMode="numeric"
                                                className="score"
                                            />
                                        </label>
                                    </div>

                                    <div className="calc">
                                        <div>합계 <b>{r.total}</b></div>
                                        <div>에버 <b>{r.avg}</b></div>
                                    </div>
                                </div>
                            );
                        })}

                        {!loadingMeeting && rows.length === 0 && <div className="muted">참가자가 없습니다. 왼쪽에서 추가하세요.</div>}
                    </div>
                </section>
            </div>

            <style jsx>{`
        .wrap { max-width: 980px; margin: 0 auto; padding: 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto; }
        .top { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
        .h1 { margin: 0; }
        .right { display:flex; gap:8px; }
        .btn { border:1px solid #ddd; border-radius:12px; padding:10px 12px; text-decoration:none; color:#111; background:white; }
        .btn2 { border:1px solid #ddd; border-radius:12px; padding:10px 12px; background:white; cursor:pointer; }

        .err { color:#b00020; margin: 10px 0; white-space: pre-wrap; }

        .card { border:1px solid #eee; border-radius:16px; padding:12px; background:white; }
        .bar { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; margin-top: 12px; flex-wrap:wrap; }
        .label { display:flex; flex-direction:column; gap:6px; }
        .select { padding:10px; border-radius:12px; border:1px solid #ccc; min-width: 320px; }
        .secTitle { font-weight:900; margin-bottom: 10px; }
        .mini { color:#666; font-weight:700; font-size: 13px; margin-left: 6px; }

        .layout { display:grid; grid-template-columns: 1fr; gap: 12px; margin-top: 12px; }
        @media (min-width: 900px) { .layout { grid-template-columns: 360px 1fr; align-items:start; } }

        .input { width:100%; padding:10px; border-radius:12px; border:1px solid #ccc; }
        .picker { margin-top: 10px; border:1px solid #eee; border-radius:14px; max-height: 240px; overflow:auto; }
        .pickBtn { width:100%; text-align:left; padding:10px; border:none; border-bottom:1px solid #f0f0f0; background:white; cursor:pointer; }
        .pickBtn:last-child { border-bottom:none; }
        .hint { margin-top: 10px; color:#666; font-size: 13px; }

        .grid { display:grid; gap: 10px; }
        .rowCard { border:1px solid #eee; border-radius:16px; padding:12px; background:white; }
        .rowTop { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
        .name { font-weight:900; }
        .del { border:1px solid #f0bdbd; background:#fff5f5; border-radius:12px; padding:8px 10px; cursor:pointer; }
        .status { color:#666; font-size: 12px; }
        .status.saving { color:#666; }
        .status.saved { color:#0a7; font-weight: 800; }
        .status.error { color:#b00020; font-weight: 800; }

        .inputs { display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top: 10px; }
        .g { display:flex; flex-direction:column; gap:6px; font-size: 12px; color:#666; }
        .score { padding:10px; border-radius:12px; border:1px solid #ccc; font-size: 16px; color:#111; }

        .calc { display:flex; justify-content:space-between; margin-top: 10px; color:#666; }
        .muted { color:#666; padding: 8px 2px; }

        @media (max-width: 480px) {
          .wrap { padding: 12px; }
          .select { min-width: 240px; }
        }
      `}</style>
        </div>
    );
}
