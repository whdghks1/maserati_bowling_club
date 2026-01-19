// pages/members-admin.js
import { useEffect, useMemo, useState } from "react";

function Modal({ open, title, onClose, children }) {
    if (!open) return null;
    return (
        <div className="mOverlay" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="mBox" onClick={(e) => e.stopPropagation()}>
                <div className="mHead">
                    <div className="mTitle">{title}</div>
                    <button className="mClose" type="button" onClick={onClose}>닫기</button>
                </div>
                <div className="mBody">{children}</div>
            </div>

            <style jsx>{`
        .mOverlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.35);
          display: flex; justify-content: center; align-items: center;
          padding: 14px; z-index: 9999;
        }
        .mBox {
          width: min(640px, 100%);
          max-height: min(82vh, 720px);
          background: white;
          border-radius: 16px;
          border: 1px solid #e6e6e6;
          overflow: hidden;
        }
        .mHead {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid #eee;
          background: #fafafa;
        }
        .mTitle { font-weight: 900; }
        .mClose {
          padding: 8px 10px; border-radius: 12px;
          border: 1px solid #ddd; background: white;
          cursor: pointer;
        }
        .mBody { padding: 12px 14px; overflow: auto; }
      `}</style>
        </div>
    );
}

export default function MembersAdminPage() {
    const [q, setQ] = useState("");
    const [includeInactive, setIncludeInactive] = useState(false);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [members, setMembers] = useState([]);

    const [newName, setNewName] = useState("");
    const [addLoading, setAddLoading] = useState(false);
    const [addErr, setAddErr] = useState("");

    // rename modal
    const [editOpen, setEditOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null); // {id, name, is_active}
    const [editName, setEditName] = useState("");
    const [editLoading, setEditLoading] = useState(false);
    const [editErr, setEditErr] = useState("");

    const listUrl = useMemo(() => {
        const p = new URLSearchParams();
        if (q.trim()) p.set("q", q.trim());
        if (includeInactive) p.set("include_inactive", "1");
        return `/api/members?${p.toString()}`;
    }, [q, includeInactive]);

    async function load() {
        setErr("");
        setLoading(true);
        try {
            const res = await fetch(listUrl);
            const json = await res.json().catch(() => []);
            if (!res.ok) throw new Error(json?.detail || json?.error || `members failed: ${res.status}`);
            setMembers(Array.isArray(json) ? json : []);
        } catch (e) {
            setErr(String(e?.message ?? e));
            setMembers([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [listUrl]);

    async function addMember() {
        const name = newName.trim();
        if (!name) return;
        setAddErr("");
        setAddLoading(true);
        try {
            const res = await fetch("/api/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                // 중복 금지: 409 또는 에러 메시지 표시
                throw new Error(json?.detail || json?.error || `add failed: ${res.status}`);
            }
            setNewName("");
            await load();
        } catch (e) {
            setAddErr(String(e?.message ?? e));
        } finally {
            setAddLoading(false);
        }
    }

    async function toggleActive(m) {
        // 삭제 대신 활성/비활성 토글
        const next = !m.is_active;
        // UX: 바로 반영(낙관적) 후 실패하면 롤백
        setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_active: next } : x)));
        try {
            const res = await fetch("/api/members", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: m.id, is_active: next }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `update failed: ${res.status}`);
            // 성공: 필요 시 재조회
            await load();
        } catch (e) {
            // 롤백
            setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_active: m.is_active } : x)));
            alert(`상태 변경 실패: ${String(e?.message ?? e)}`);
        }
    }

    function openRename(m) {
        setEditTarget(m);
        setEditName(m.name || "");
        setEditErr("");
        setEditOpen(true);
    }

    async function saveRename() {
        if (!editTarget) return;
        const name = editName.trim();
        if (!name) {
            setEditErr("이름을 입력해줘.");
            return;
        }
        setEditErr("");
        setEditLoading(true);
        try {
            const res = await fetch("/api/members", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: editTarget.id, name }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `rename failed: ${res.status}`);
            setEditOpen(false);
            setEditTarget(null);
            await load();
        } catch (e) {
            setEditErr(String(e?.message ?? e));
        } finally {
            setEditLoading(false);
        }
    }

    const activeCount = useMemo(() => members.filter((m) => m.is_active).length, [members]);
    const inactiveCount = useMemo(() => members.filter((m) => !m.is_active).length, [members]);

    return (
        <div className="wrap">
            <h1 className="h1">멤버 관리</h1>
            <p className="desc">
                삭제 대신 <b>비활성</b>으로 관리합니다. (과거 기록 보존)
            </p>

            {/* 상단: 추가 */}
            <section className="card">
                <div className="secTitle">멤버 추가</div>
                <div className="addRow">
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="이름 입력 (중복 금지)"
                        className="input"
                    />
                    <button
                        type="button"
                        className="btnPrimary"
                        onClick={addMember}
                        disabled={addLoading || !newName.trim()}
                    >
                        {addLoading ? "추가 중..." : "추가"}
                    </button>
                </div>
                {addErr && <div className="err">추가 실패: {addErr}</div>}
            </section>

            {/* 필터 */}
            <section className="card" style={{ marginTop: 12 }}>
                <div className="row">
                    <div className="secTitle" style={{ marginBottom: 0 }}>목록</div>
                    <div className="pill">
                        활성 <b>{activeCount}</b> · 비활성 <b>{inactiveCount}</b>
                    </div>
                </div>

                <div className="filters">
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="검색 (예: 종환)"
                        className="input"
                    />

                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={includeInactive}
                            onChange={(e) => setIncludeInactive(e.target.checked)}
                        />
                        <span>비활성 포함</span>
                    </label>

                    <button type="button" className="btn" onClick={load} disabled={loading}>
                        {loading ? "불러오는 중..." : "새로고침"}
                    </button>
                </div>

                {err && <div className="err">오류: {err}</div>}

                {/* 리스트 */}
                <div className="list">
                    {members.map((m) => (
                        <div key={m.id} className={`item ${m.is_active ? "" : "inactive"}`}>
                            <div className="left">
                                <div className="nameRow">
                                    <div className="name">{m.name}</div>
                                    <span className={`badge ${m.is_active ? "on" : "off"}`}>
                                        {m.is_active ? "활성" : "비활성"}
                                    </span>
                                </div>
                                <div className="sub">id: {m.id}</div>
                            </div>

                            <div className="right">
                                <button type="button" className="btn" onClick={() => openRename(m)}>
                                    이름수정
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${m.is_active ? "danger" : "ok"}`}
                                    onClick={() => toggleActive(m)}
                                >
                                    {m.is_active ? "비활성" : "활성"}
                                </button>
                            </div>
                        </div>
                    ))}

                    {!loading && members.length === 0 && (
                        <div className="muted">표시할 멤버가 없습니다.</div>
                    )}
                </div>
            </section>

            {/* 이름 수정 모달 */}
            <Modal
                open={editOpen}
                title={editTarget ? `이름 수정 · ${editTarget.name}` : "이름 수정"}
                onClose={() => { setEditOpen(false); setEditTarget(null); }}
            >
                <div className="modalCol">
                    <label className="label">새 이름 (중복 금지)</label>
                    <input
                        className="input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="예: 박종환"
                    />
                    {editErr && <div className="err">{editErr}</div>}

                    <div className="modalBtns">
                        <button type="button" className="btn" onClick={() => { setEditOpen(false); setEditTarget(null); }}>
                            취소
                        </button>
                        <button type="button" className="btnPrimary" onClick={saveRename} disabled={editLoading}>
                            {editLoading ? "저장 중..." : "저장"}
                        </button>
                    </div>

                    <div className="muted" style={{ marginTop: 10 }}>
                        * 이름을 바꿔도 벙/정기전 기록은 member_id로 연결되어 유지됩니다.
                    </div>
                </div>
            </Modal>

            <style jsx>{`
        .wrap {
          max-width: 980px;
          margin: 0 auto;
          padding: 16px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto;
        }
        .h1 { margin: 0 0 6px 0; }
        .desc { margin: 0 0 12px 0; color: #666; }

        .card {
          border: 1px solid #eee;
          border-radius: 16px;
          padding: 12px;
          background: white;
        }
        .secTitle { font-weight: 900; margin-bottom: 10px; }

        .addRow {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
        }

        .filters {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-top: 10px;
        }
        @media (min-width: 700px) {
          .filters { grid-template-columns: 1fr auto auto; align-items: center; }
        }

        .input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #ddd;
          outline: none;
        }
        .input:focus { border-color: #111; }

        .btn, .btnPrimary {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          white-space: nowrap;
        }
        .btnPrimary {
          border-color: #111;
          background: #111;
          color: white;
          font-weight: 900;
        }
        .btn:disabled, .btnPrimary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .toggle {
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: 14px;
          color: #333;
          user-select: none;
          white-space: nowrap;
        }

        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .pill {
          border: 1px solid #eee;
          background: #fafafa;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 13px;
          color: #444;
          white-space: nowrap;
        }

        .list { display: grid; gap: 10px; margin-top: 12px; }

        .item {
          border: 1px solid #eee;
          border-radius: 16px;
          padding: 12px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          background: white;
        }
        @media (min-width: 700px) {
          .item { grid-template-columns: 1fr auto; align-items: center; }
        }

        .item.inactive {
          opacity: 0.72;
          background: #fcfcfc;
        }

        .left { min-width: 0; }
        .nameRow { display: flex; gap: 10px; align-items: center; min-width: 0; }
        .name {
          font-weight: 900;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .sub { margin-top: 4px; color: #777; font-size: 12px; }

        .badge {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid #ddd;
          white-space: nowrap;
        }
        .badge.on { border-color: #28a745; color: #28a745; }
        .badge.off { border-color: #dc3545; color: #dc3545; }

        .right { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
        .danger { border-color: #dc3545; color: #dc3545; font-weight: 900; }
        .ok { border-color: #28a745; color: #28a745; font-weight: 900; }

        .muted { color: #666; }
        .err { color: #b00020; margin-top: 10px; }

        .modalCol { display: grid; gap: 10px; }
        .label { font-size: 13px; color: #666; }
        .modalBtns { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
      `}</style>
        </div>
    );
}
