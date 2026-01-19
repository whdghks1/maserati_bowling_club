// pages/bungs.js
import { useEffect, useMemo, useState } from "react";

function toDatetimeLocalValue(d = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function BungsPage() {
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const [memberSearch, setMemberSearch] = useState("");
    const [pickerOpen, setPickerOpen] = useState(false);

    // 멤버 목록 (attendee 추가용)
    const [members, setMembers] = useState([]);
    const [membersErr, setMembersErr] = useState("");

    // 벙 목록
    const [bungs, setBungs] = useState([]);
    const [selectedBungId, setSelectedBungId] = useState(null);

    // 선택 벙 참석자 목록
    const [attendees, setAttendees] = useState([]);
    const [attLoading, setAttLoading] = useState(false);
    const [attErr, setAttErr] = useState("");

    // 생성 폼
    const [form, setForm] = useState({
        bung_at: toDatetimeLocalValue(new Date()),
        title: "",
        center_name: "",
        note: "",
    });

    const selectedBung = useMemo(
        () => bungs.find((b) => b.id === selectedBungId) || null,
        [bungs, selectedBungId]
    );

    async function loadMembers() {
        setMembersErr("");
        try {
            const res = await fetch("/api/members");
            const data = await res.json().catch(() => []);
            if (!res.ok) throw new Error(data?.detail || data?.error || `members failed: ${res.status}`);
            setMembers(Array.isArray(data) ? data : []);
        } catch (e) {
            setMembersErr(String(e?.message ?? e));
        }
    }

    async function loadBungs() {
        setErr("");
        setLoading(true);
        try {
            const res = await fetch("/api/bungs?limit=200");
            const data = await res.json().catch(() => []);
            if (!res.ok) throw new Error(data?.detail || data?.error || `bungs failed: ${res.status}`);
            setBungs(Array.isArray(data) ? data : []);
            if (!selectedBungId && Array.isArray(data) && data[0]?.id) setSelectedBungId(data[0].id);
        } catch (e) {
            setErr(String(e?.message ?? e));
        } finally {
            setLoading(false);
        }
    }

    async function loadAttendees(bungId) {
        if (!bungId) return;
        setAttErr("");
        setAttLoading(true);
        try {
            const res = await fetch(`/api/bung-attendees?bung_id=${bungId}`);
            const data = await res.json().catch(() => []);
            if (!res.ok) throw new Error(data?.detail || data?.error || `attendees failed: ${res.status}`);
            setAttendees(Array.isArray(data) ? data : []);
        } catch (e) {
            setAttErr(String(e?.message ?? e));
        } finally {
            setAttLoading(false);
        }
    }

    useEffect(() => {
        loadMembers();
        loadBungs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedBungId) loadAttendees(selectedBungId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBungId]);

    async function createBung() {
        setErr("");
        try {
            const res = await fetch("/api/bungs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bung_at: form.bung_at, // datetime-local 값 그대로 전달 (API에서 +09:00 처리)
                    title: form.title.trim() || null,
                    center_name: form.center_name.trim() || null,
                    note: form.note.trim() || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.detail || data?.error || `create failed: ${res.status}`);

            setForm((p) => ({ ...p, title: "", center_name: "", note: "" }));
            await loadBungs();
        } catch (e) {
            setErr(String(e?.message ?? e));
        }
    }

    async function deleteBung(id) {
        if (!confirm("이 벙을 삭제할까요? (참석자도 같이 삭제됨)")) return;
        setErr("");
        try {
            const res = await fetch(`/api/bungs?id=${id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.detail || data?.error || `delete failed: ${res.status}`);
            setSelectedBungId(null);
            setAttendees([]);
            await loadBungs();
        } catch (e) {
            setErr(String(e?.message ?? e));
        }
    }

    async function addAttendee(memberId) {
        if (!selectedBungId) return;
        setAttErr("");
        try {
            const res = await fetch("/api/bung-attendees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bung_id: selectedBungId, member_id: memberId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.detail || data?.error || `add failed: ${res.status}`);
            await loadAttendees(selectedBungId);
            await loadBungs(); // attendee_count 갱신
        } catch (e) {
            setAttErr(String(e?.message ?? e));
        }
    }

    async function removeAttendee(memberId) {
        if (!selectedBungId) return;
        setAttErr("");
        try {
            const res = await fetch(
                `/api/bung-attendees?bung_id=${selectedBungId}&member_id=${memberId}`,
                { method: "DELETE" }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.detail || data?.error || `remove failed: ${res.status}`);
            await loadAttendees(selectedBungId);
            await loadBungs(); // attendee_count 갱신
        } catch (e) {
            setAttErr(String(e?.message ?? e));
        }
    }

    const availableMembers = useMemo(() => {
        const picked = new Set(attendees.map((a) => a.member_id));
        const keyword = memberSearch.trim().toLowerCase();

        return members
            .filter((m) => !picked.has(m.id))
            .filter((m) => {
                if (!keyword) return true;
                return String(m.name || "").toLowerCase().includes(keyword);
            });
    }, [members, attendees, memberSearch]);

    return (
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
            <h1 style={{ marginBottom: 6 }}>벙 관리</h1>
            <p style={{ marginTop: 0, color: "#666" }}>
                벙은 <b>날짜+시간</b>으로 식별되며, <b>4명 이상 참석</b>이면 유효 벙으로 카운트됩니다.
            </p>

            {err && (
                <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5", borderRadius: 8, marginBottom: 12 }}>
                    오류: {err}
                </div>
            )}
            {membersErr && (
                <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5", borderRadius: 8, marginBottom: 12 }}>
                    멤버 불러오기 실패: {membersErr}
                </div>
            )}

            {/* 생성 폼 */}
            <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10, marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>새 벙 등록</h2>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>날짜/시간 (KST)</span>
                        <input
                            type="datetime-local"
                            value={form.bung_at}
                            onChange={(e) => setForm((p) => ({ ...p, bung_at: e.target.value }))}
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                        />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>제목 (선택)</span>
                        <input
                            value={form.title}
                            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                        />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>센터명 (선택)</span>
                        <input
                            value={form.center_name}
                            onChange={(e) => setForm((p) => ({ ...p, center_name: e.target.value }))}
                            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                        />
                    </label>
                </div>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                    <span>메모 (선택)</span>
                    <input
                        value={form.note}
                        onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                        style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                    />
                </label>

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button
                        type="button"
                        onClick={createBung}
                        style={{
                            padding: "12px 16px",
                            borderRadius: 10,
                            border: "1px solid #111",
                            background: "#111",
                            color: "white",
                            cursor: "pointer",
                            minWidth: 120,
                        }}
                    >
                        등록
                    </button>

                    <button
                        type="button"
                        onClick={loadBungs}
                        disabled={loading}
                        style={{
                            padding: "12px 16px",
                            borderRadius: 10,
                            border: "1px solid #ccc",
                            background: "white",
                            cursor: loading ? "not-allowed" : "pointer",
                        }}
                    >
                        {loading ? "불러오는 중..." : "새로고침"}
                    </button>
                </div>
            </section>

            {/* 목록 + 상세 */}
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 14 }}>
                <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
                    <h2 style={{ marginTop: 0, fontSize: 18 }}>벙 목록</h2>

                    {bungs.length === 0 && <div style={{ color: "#666" }}>등록된 벙이 없습니다.</div>}

                    <div style={{ display: "grid", gap: 8 }}>
                        {bungs.map((b) => (
                            <button
                                key={b.id}
                                type="button"
                                onClick={() => setSelectedBungId(b.id)}
                                style={{
                                    textAlign: "left",
                                    padding: 10,
                                    borderRadius: 10,
                                    border: selectedBungId === b.id ? "2px solid #111" : "1px solid #ddd",
                                    background: "white",
                                    cursor: "pointer",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>
                                            {new Date(b.bung_at).toLocaleString("ko-KR")}
                                        </div>
                                        <div style={{ color: "#666", fontSize: 13 }}>
                                            {b.title || "(제목 없음)"} {b.center_name ? `· ${b.center_name}` : ""}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontWeight: 700 }}>
                                            {b.attendee_count}명
                                        </div>
                                        <div style={{ fontSize: 12, color: b.is_valid ? "green" : "#999" }}>
                                            {b.is_valid ? "유효(4+)" : "미달"}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
                    <h2 style={{ marginTop: 0, fontSize: 18 }}>벙 상세 / 참석자</h2>

                    {!selectedBung && <div style={{ color: "#666" }}>왼쪽에서 벙을 선택하세요.</div>}

                    {selectedBung && (
                        <>
                            <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 10, marginBottom: 10 }}>
                                <div style={{ fontWeight: 800 }}>{new Date(selectedBung.bung_at).toLocaleString("ko-KR")}</div>
                                <div style={{ color: "#666", marginTop: 4 }}>
                                    {selectedBung.title || "(제목 없음)"} {selectedBung.center_name ? `· ${selectedBung.center_name}` : ""}
                                </div>
                                {selectedBung.note && <div style={{ marginTop: 6 }}>{selectedBung.note}</div>}

                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, alignItems: "center" }}>
                                    <div style={{ fontSize: 13, color: "#666" }}>
                                        참석: <b>{selectedBung.attendee_count}명</b> / {selectedBung.is_valid ? "유효 벙" : "미달"}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => deleteBung(selectedBung.id)}
                                        style={{
                                            padding: "10px 12px",
                                            borderRadius: 10,
                                            border: "1px solid #f2c2c2",
                                            background: "#fff5f5",
                                            cursor: "pointer",
                                        }}
                                    >
                                        벙 삭제
                                    </button>
                                </div>
                            </div>

                            {attErr && (
                                <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5", borderRadius: 8, marginBottom: 12 }}>
                                    참석자 오류: {attErr}
                                </div>
                            )}

                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <button
                                        type="button"
                                        onClick={() => setPickerOpen((v) => !v)}
                                        style={{
                                            flex: 1,
                                            padding: "10px 12px",
                                            borderRadius: 10,
                                            border: "1px solid #ccc",
                                            background: "white",
                                            cursor: "pointer",
                                            textAlign: "left",
                                        }}
                                    >
                                        참석 추가 {pickerOpen ? "▲" : "▼"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => loadAttendees(selectedBungId)}
                                        disabled={attLoading}
                                        style={{
                                            padding: "10px 12px",
                                            borderRadius: 10,
                                            border: "1px solid #ccc",
                                            background: "white",
                                            cursor: attLoading ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        {attLoading ? "불러오는 중..." : "새로고침"}
                                    </button>
                                </div>

                                {pickerOpen && (
                                    <div style={{ marginTop: 8, border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
                                        <div style={{ padding: 10, borderBottom: "1px solid #eee", background: "#fafafa" }}>
                                            <input
                                                value={memberSearch}
                                                onChange={(e) => setMemberSearch(e.target.value)}
                                                placeholder="멤버 검색 (예: 종환)"
                                                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                                                autoFocus
                                            />
                                            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                                                {availableMembers.length}명 표시
                                            </div>
                                        </div>

                                        <div style={{ maxHeight: 220, overflow: "auto" }}>
                                            {availableMembers.length === 0 ? (
                                                <div style={{ padding: 10, color: "#666" }}>추가할 멤버가 없습니다.</div>
                                            ) : (
                                                availableMembers.map((m) => (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => {
                                                            addAttendee(m.id);
                                                            setMemberSearch("");
                                                            // setPickerOpen(false); // ✅ 추가 후 자동 닫기 (원하면 제거)
                                                        }}
                                                        style={{
                                                            width: "100%",
                                                            textAlign: "left",
                                                            padding: 10,
                                                            border: "none",
                                                            borderBottom: "1px solid #eee",
                                                            background: "white",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        + {m.name}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>


                            {attendees.length === 0 && <div style={{ color: "#666" }}>아직 참석자가 없습니다.</div>}

                            <div style={{ display: "grid", gap: 8 }}>
                                {attendees.map((a) => (
                                    <div
                                        key={a.member_id}
                                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, border: "1px solid #ddd", borderRadius: 10 }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{a.name}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeAttendee(a.member_id)}
                                            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer" }}
                                        >
                                            제거
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
