// pages/members.js
import { useEffect, useMemo, useState } from "react";

function levelLabel(level) {
    return `${level}레벨`;
}

export default function MembersPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const [form, setForm] = useState({
        name: "",
        average: "",
        games_played: "0",
        total_pins: "0",
    });

    const canSubmit = useMemo(() => {
        const nameOk = form.name.trim().length > 0;
        const avg = Number(form.average);
        const avgOk = Number.isFinite(avg);
        return nameOk && avgOk;
    }, [form]);

    async function refresh() {
        setLoading(true);
        setErr("");
        try {
            const res = await fetch("/api/members");
            if (!res.ok) throw new Error(`load failed: ${res.status}`);
            const data = await res.json();
            setRows(Array.isArray(data) ? data : []);
        } catch (e) {
            setErr(String(e?.message ?? e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    async function createMember() {
        setErr("");
        try {
            const res = await fetch("/api/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    average: Number(form.average),
                    games_played: Number(form.games_played || 0),
                    total_pins: Number(form.total_pins || 0),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.detail || data?.error || `create failed: ${res.status}`);

            setForm({ name: "", average: "", games_played: "0", total_pins: "0" });
            await refresh();
        } catch (e) {
            setErr(String(e?.message ?? e));
        }
    }

    async function updateMember(r) {
        setErr("");
        try {
            const res = await fetch("/api/members", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: r.id,
                    name: r.name,
                    average: Number(r.average),
                    games_played: Number(r.games_played),
                    total_pins: Number(r.total_pins),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.detail || data?.error || `update failed: ${res.status}`);
            await refresh();
        } catch (e) {
            setErr(String(e?.message ?? e));
        }
    }

    async function deleteMember(id) {
        if (!confirm("삭제할까요?")) return;
        setErr("");
        try {
            const res = await fetch(`/api/members?id=${id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.detail || data?.error || `delete failed: ${res.status}`);
            await refresh();
        } catch (e) {
            setErr(String(e?.message ?? e));
        }
    }

    return (
        <div className="page">
            <h1 style={{ marginBottom: 6 }}>클럽 인원 관리</h1>
            <p style={{ marginTop: 0, color: "#666" }}>이름은 중복 불가. 레벨은 에버로 자동 계산됩니다.</p>

            {err && (
                <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5", borderRadius: 8, marginBottom: 12 }}>
                    {err}
                </div>
            )}

            <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10, marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>새 인원 추가</h2>
                <div className="addGrid">
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>이름</span>
                        <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>에버</span>
                        <input value={form.average} onChange={(e) => setForm((p) => ({ ...p, average: e.target.value }))} inputMode="numeric" style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>참여회수</span>
                        <input value={form.games_played} onChange={(e) => setForm((p) => ({ ...p, games_played: e.target.value }))} inputMode="numeric" style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }} />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span>총핀</span>
                        <input value={form.total_pins} onChange={(e) => setForm((p) => ({ ...p, total_pins: e.target.value }))} inputMode="numeric" style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }} />
                    </label>
                    <button
                        type="button"
                        className="addButton"
                        disabled={!canSubmit}
                        onClick={createMember}
                        style={{
                            padding: "11px 14px",
                            borderRadius: 10,
                            border: "1px solid #111",
                            background: canSubmit ? "#111" : "#ddd",
                            color: canSubmit ? "white" : "#333",
                            cursor: canSubmit ? "pointer" : "not-allowed",
                        }}
                    >
                        추가
                    </button>
                </div>
            </section>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>등록된 인원</h2>
                <button type="button" onClick={refresh} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", background: "white" }}>
                    {loading ? "불러오는 중..." : "새로고침"}
                </button>
            </div>

            <div className="tableWrap">
                <table className="membersTable">
                    <thead>
                        <tr style={{ background: "#fafafa" }}>
                            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>이름</th>
                            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>레벨</th>
                            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>에버</th>
                            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>참여회수</th>
                            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>총핀</th>
                            <th style={{ padding: 10, borderBottom: "1px solid #eee" }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td className="nameCell" data-label="이름" style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                                    <input className="cellInput nameInput" value={r.name} onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))} />
                                </td>
                                <td className="levelCell" data-label="레벨" style={{ padding: 10, borderBottom: "1px solid #f2f2f2", color: "#444" }}>{levelLabel(r.level)}</td>
                                <td data-label="에버" style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                                    <input className="cellInput numberInput" value={r.average} onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, average: e.target.value } : x)))} inputMode="numeric" />
                                </td>
                                <td data-label="참여회수" style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                                    <input className="cellInput numberInput" value={r.games_played} onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, games_played: e.target.value } : x)))} inputMode="numeric" />
                                </td>
                                <td data-label="총핀" style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                                    <input className="cellInput totalInput" value={r.total_pins} onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, total_pins: e.target.value } : x)))} inputMode="numeric" />
                                </td>
                                <td className="actions" style={{ padding: 10, borderBottom: "1px solid #f2f2f2", whiteSpace: "nowrap" }}>
                                    <button type="button" onClick={() => updateMember(r)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", background: "white", marginRight: 8 }}>
                                        저장
                                    </button>
                                    <button type="button" onClick={() => deleteMember(r.id)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #f2c2c2", background: "#fff5f5" }}>
                                        삭제
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ padding: 14, color: "#666" }}>
                                    아직 등록된 인원이 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <style jsx>{`
                .page {
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 16px;
                    font-family: system-ui, -apple-system, Segoe UI, Roboto;
                }
                .addGrid {
                    display: grid;
                    grid-template-columns: 1.2fr 1fr 1fr 1fr auto;
                    gap: 10px;
                    margin-top: 10px;
                    align-items: end;
                }
                .addGrid :global(input), .cellInput { box-sizing: border-box; min-width: 0; }
                .addButton { min-width: 120px; }
                .tableWrap {
                    overflow-x: auto;
                    border: 1px solid #eee;
                    border-radius: 10px;
                }
                .membersTable { width: 100%; border-collapse: collapse; }
                .cellInput {
                    padding: 8px;
                    border-radius: 8px;
                    border: 1px solid #ddd;
                }
                .nameInput { width: 100%; min-width: 120px; }
                .numberInput { width: 110px; }
                .totalInput { width: 130px; }

                @media (max-width: 640px) {
                    .page { padding: 12px; }
                    .addGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .addGrid > :first-child { grid-column: 1 / -1; }
                    .addButton { grid-column: 1 / -1; width: 100%; min-width: 0; }

                    .tableWrap { overflow: visible; border: 0; border-radius: 0; }
                    .membersTable, .membersTable tbody { display: block; width: 100%; }
                    .membersTable thead { display: none; }
                    .membersTable tr {
                        display: grid;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 10px 12px;
                        width: 100%;
                        box-sizing: border-box;
                        padding: 12px;
                        margin-bottom: 10px;
                        border: 1px solid #e8e8e8;
                        border-radius: 14px;
                        background: #fff;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                    }
                    .membersTable td {
                        display: flex;
                        flex-direction: column;
                        gap: 5px;
                        min-width: 0;
                        padding: 0 !important;
                        border-bottom: 0 !important;
                    }
                    .membersTable td:not(.actions)::before {
                        content: attr(data-label);
                        color: #777;
                        font-size: 11px;
                        font-weight: 700;
                    }
                    .nameCell { grid-column: 1 / -1; }
                    .levelCell {
                        justify-content: flex-end;
                        padding-bottom: 9px !important;
                        font-weight: 800;
                    }
                    .cellInput { width: 100%; min-width: 0; font-size: 16px; }
                    .actions {
                        grid-column: 1 / -1;
                        display: grid !important;
                        grid-template-columns: 1fr 1fr;
                        gap: 8px !important;
                        padding-top: 2px !important;
                    }
                    .actions button { width: 100%; margin: 0 !important; }
                }
            `}</style>
        </div>
    );
}
