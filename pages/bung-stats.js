// pages/bung-stats.js
import { useEffect, useMemo, useState } from "react";

/* ---------- date helpers ---------- */
function pad2(n) { return String(n).padStart(2, "0"); }
function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function ym(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function addMonths(d, delta) { return new Date(d.getFullYear(), d.getMonth() + delta, 1); }
function kstStartIso(d) { return `${ymd(d)}T00:00:00+09:00`; }
function kstEndIso(d) { return `${ymd(d)}T23:59:59+09:00`; }
function fmtTime(iso) {
    const dt = new Date(iso);
    return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

/* ---------- range presets ---------- */
const PRESETS = [
    { key: "month", label: "월" },
    { key: "6m", label: "6개월" },
    { key: "1y", label: "1년" },
    { key: "all", label: "전체" },
];

function computeRange(presetKey, anchorMonthDate) {
    const anchorStart = startOfMonth(anchorMonthDate);
    const anchorEnd = endOfMonth(anchorMonthDate);

    if (presetKey === "all") return { from: null, to: null };

    if (presetKey === "month") {
        return { from: kstStartIso(anchorStart), to: kstEndIso(anchorEnd) };
    }

    if (presetKey === "6m") {
        const fromMonth = addMonths(anchorStart, -5);
        return { from: kstStartIso(fromMonth), to: kstEndIso(anchorEnd) };
    }

    const fromMonth = addMonths(anchorStart, -11);
    return { from: kstStartIso(fromMonth), to: kstEndIso(anchorEnd) };
}

/* ---------- Modal ---------- */
function Modal({ open, title, onClose, children }) {
    if (!open) return null;
    return (
        <div className="mOverlay" role="dialog" aria-modal="true">
            <div className="mBox">
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
          width: min(720px, 100%);
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

/* ---------- Calendar (no library) ---------- */
function weekdayIndexMon0(date) {
    const d = date.getDay(); // Sun=0
    return (d + 6) % 7; // Mon=0
}
function buildMonthCells(year, monthIndex) {
    const first = new Date(year, monthIndex, 1);
    const last = new Date(year, monthIndex + 1, 0);
    const lead = weekdayIndexMon0(first);
    const daysInMonth = last.getDate();

    const total = lead + daysInMonth;
    const weeks = Math.ceil(total / 7);
    const totalCells = weeks * 7;

    const out = [];
    for (let i = 0; i < totalCells; i++) {
        const dayNum = i - lead + 1;
        const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
        out.push(inMonth ? new Date(year, monthIndex, dayNum) : null);
    }
    return out;
}

function BungCalendar({ year, monthIndex, calendarDays, onClickDay }) {
    const cells = useMemo(() => buildMonthCells(year, monthIndex), [year, monthIndex]);

    return (
        <div className="cal">
            <div className="dow">
                {["월", "화", "수", "목", "금", "토", "일"].map((w) => (
                    <div key={w} className="dowCell">{w}</div>
                ))}
            </div>

            <div className="grid">
                {cells.map((dateObj, idx) => {
                    if (!dateObj) {
                        return <div key={`empty-${idx}`} className="cell cellOff" />;
                    }

                    const dayKey = ymd(dateObj);
                    const raw = calendarDays?.[dayKey] || [];

                    // ✅ 유효 먼저, 이후 시간순
                    const bungsSorted = [...raw].sort((a, b) => {
                        if (a.is_valid !== b.is_valid) return a.is_valid ? -1 : 1;
                        return new Date(a.bung_at) - new Date(b.bung_at);
                    });

                    const maxShow = 2;
                    const show = bungsSorted.slice(0, maxShow);
                    const more = bungsSorted.length - show.length;

                    return (
                        <button
                            key={dayKey}
                            type="button"
                            className="cell"
                            onClick={() => onClickDay?.(dayKey)}
                        >
                            <div className="dateRow">
                                <div className="dateNum">{dateObj.getDate()}</div>
                            </div>

                            <div className="events">
                                {show.map((b) => {
                                    const icon = b.is_valid ? "✓" : "!";
                                    const time = fmtTime(b.bung_at);
                                    const title = b.title || ""; // 없으면 빈칸

                                    // ✅ 미리보기는 "A, B…" 형태로 이미 API가 만들어줌(최대 3명 + …)
                                    // 요구: 2명 + … 로 보이게 -> 프론트에서 한 번 더 줄여줌
                                    const names = (b.attendee_names_preview || "").split(",").map(s => s.trim()).filter(Boolean);

                                    let namesLine = "";
                                    if (names.length === 0) {
                                        namesLine = `${b.attendee_count}명`; // 참석자 데이터가 없으면 fallback
                                    } else if (names.length === 1) {
                                        namesLine = names[0];
                                    } else {
                                        // "A, B"까지만 + 나머지 있으면 …
                                        // attendee_names_preview가 이미 …를 포함할 수 있으니 보정
                                        const a = names[0];
                                        const b2 = names[1].replace("…", "");
                                        const hasMore = (b.attendee_names_preview || "").includes("…") || b.attendee_count > 2;
                                        namesLine = `${a}, ${b2}${hasMore ? "…" : ""}`;
                                    }

                                    return (
                                        <div
                                            key={b.bung_id}
                                            className={`chip ${b.is_valid ? "chipValid" : "chipInvalid"}`}
                                            title={`${time} · ${b.is_valid ? "유효" : "비유효"}${title ? ` · ${title}` : ""} · ${b.attendee_names_preview || ""}`}
                                        >
                                            <div className="chipTop">
                                                <span className="chipIcon">{icon}</span>
                                                <span className="chipTime">{time}</span>
                                                <span className="chipTitle">{title}</span>
                                            </div>

                                            <div className="chipBottom">
                                                <span className="chipNames">{namesLine}</span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {more > 0 && (
                                    <button
                                        type="button"
                                        className="more"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onClickDay?.(dayKey);
                                        }}
                                    >
                                        +{more}
                                    </button>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            <style jsx>{`
        .dow {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
          margin-bottom: 6px;
        }
        .dowCell {
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        .cell {
          border: 1px solid #e6e6e6;
          border-radius: 14px;
          padding: 8px;
          background: white;
          min-height: 92px;
          text-align: left;
          cursor: pointer;
        }
        .cellOff {
          background: transparent;
          border: 1px dashed #eee;
          border-radius: 14px;
          min-height: 92px;
        }
        .dateRow { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
        .dateNum { font-weight: 900; font-size: 13px; }

        .events { display:grid; gap:6px; }

        .chip {
        display: grid;
        grid-template-rows: auto auto;
        gap: 4px;
        padding: 8px 8px;
        border-radius: 12px;
        font-size: 12px;
        border: 2px solid transparent;  /* ✅ 테두리로 구분 */
        background: white;
        min-width: 0;
        }

        .chipValid { border-color: #28a745; }
        .chipInvalid { border-color: #dc3545; }

        .chipTop {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0; /* ✅ ellipsis 필수 */
        }

        .chipIcon {
        font-weight: 900;
        width: 14px;
        text-align: center;
        flex: 0 0 auto;
        }

        .chipTime {
        font-weight: 900;
        flex: 0 0 auto;
        }

        .chipTitle {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis; /* ✅ 제목 ... */
        color: #111;
        }

        .chipBottom {
        min-width: 0;
        }

        .chipNames {
        display: block;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis; /* ✅ 참석자 ... */
        color: #666;
        font-size: 12px;
        }

        .chipText {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;  /* ✅ ... */
        }

        /* 기본: 모바일(짧게) */
        .chipTextLong { display: none; }
        .chipTextShort { display: block; }

        /* 데스크탑: 길게 */
        @media (min-width: 900px) {
          .chipTextLong { display: block; }
          .chipTextShort { display: none; }
        }

        .more {
          width: fit-content;
          border: 1px solid #ddd;
          background: white;
          border-radius: 10px;
          padding: 4px 8px;
          font-size: 12px;
          color: #444;
          cursor: pointer;
        }

        @media (max-width: 480px) {
          .cell { min-height: 78px; padding: 6px; border-radius: 12px; }
          .cellOff { min-height: 78px; border-radius: 12px; }
          .chip { padding: 7px 7px; border-radius: 11px; }
          .chipTime { min-width: 36px; }
        }
      `}</style>
        </div>
    );
}

/* ---------- Page ---------- */
export default function BungStatsPage() {
    const [preset, setPreset] = useState("month");
    const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

    const [rankLoading, setRankLoading] = useState(false);
    const [rankErr, setRankErr] = useState("");
    const [summary, setSummary] = useState(null);
    const [rankings, setRankings] = useState([]);

    const [calLoading, setCalLoading] = useState(false);
    const [calErr, setCalErr] = useState("");
    const [calendarDays, setCalendarDays] = useState({});

    const [dayOpen, setDayOpen] = useState(false);
    const [dayKey, setDayKey] = useState(null);
    const [dayLoading, setDayLoading] = useState(false);
    const [dayErr, setDayErr] = useState("");
    const [dayData, setDayData] = useState(null);

    const [memberOpen, setMemberOpen] = useState(false);
    const [member, setMember] = useState(null);
    const [memberLoading, setMemberLoading] = useState(false);
    const [memberErr, setMemberErr] = useState("");
    const [memberData, setMemberData] = useState(null);

    const range = useMemo(() => computeRange(preset, viewMonth), [preset, viewMonth]);

    const rankingUrl = useMemo(() => {
        const p = new URLSearchParams();
        if (range.from) p.set("from", range.from);
        if (range.to) p.set("to", range.to);
        return `/api/reports/bungs/ranking?${p.toString()}`;
    }, [range]);

    const calendarUrl = useMemo(() => {
        const p = new URLSearchParams();
        p.set("month", ym(viewMonth));
        if (range.from) p.set("from", range.from);
        if (range.to) p.set("to", range.to);
        // ⚠️ 파일명이 calender.js면 여기 'calendar'를 'calender'로 바꿔야 함
        return `/api/reports/bungs/calendar?${p.toString()}`;
    }, [range, viewMonth]);

    async function loadRanking() {
        setRankErr("");
        setRankLoading(true);
        try {
            const res = await fetch(rankingUrl);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `ranking failed: ${res.status}`);
            setSummary(json.summary || null);
            setRankings(Array.isArray(json.rankings) ? json.rankings : []);
        } catch (e) {
            setRankErr(String(e?.message ?? e));
            setSummary(null);
            setRankings([]);
        } finally {
            setRankLoading(false);
        }
    }

    async function loadCalendar() {
        setCalErr("");
        setCalLoading(true);
        try {
            const res = await fetch(calendarUrl);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `calendar failed: ${res.status}`);
            setCalendarDays(json.calendarDays || {});
        } catch (e) {
            setCalErr(String(e?.message ?? e));
            setCalendarDays({});
        } finally {
            setCalLoading(false);
        }
    }

    async function openDayModal(dateKey) {
        setDayKey(dateKey);
        setDayOpen(true);
        setDayErr("");
        setDayData(null);
        setDayLoading(true);
        try {
            const res = await fetch(`/api/reports/bungs/day?date=${encodeURIComponent(dateKey)}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `day failed: ${res.status}`);

            const bungs = Array.isArray(json.bungs) ? json.bungs.slice() : [];
            bungs.sort((a, b) => {
                if (a.is_valid !== b.is_valid) return a.is_valid ? -1 : 1;
                return new Date(a.bung_at) - new Date(b.bung_at);
            });

            setDayData({ ...json, bungs });
        } catch (e) {
            setDayErr(String(e?.message ?? e));
        } finally {
            setDayLoading(false);
        }
    }

    async function openMemberModal(memberRow) {
        setMember({ member_id: memberRow.member_id, name: memberRow.name });
        setMemberOpen(true);
        setMemberErr("");
        setMemberData(null);
        setMemberLoading(true);
        try {
            const p = new URLSearchParams();
            p.set("member_id", String(memberRow.member_id));
            if (range.from) p.set("from", range.from);
            if (range.to) p.set("to", range.to);

            const res = await fetch(`/api/reports/bungs/member?${p.toString()}`);
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.detail || json?.error || `member failed: ${res.status}`);

            setMemberData(json);
        } catch (e) {
            setMemberErr(String(e?.message ?? e));
        } finally {
            setMemberLoading(false);
        }
    }

    useEffect(() => {
        loadRanking();
        loadCalendar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rankingUrl, calendarUrl]);

    const monthLabel = useMemo(() => {
        const d = viewMonth;
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    }, [viewMonth]);

    return (
        <div className="wrap">
            <h1 className="h1">벙 통계</h1>

            <div className="card">
                <div className="row">
                    <div className="seg">
                        {PRESETS.map((p) => (
                            <button
                                key={p.key}
                                type="button"
                                className={`segBtn ${preset === p.key ? "segOn" : ""}`}
                                onClick={() => setPreset(p.key)}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="monthNav">
                        <button type="button" className="navBtn" onClick={() => setViewMonth(addMonths(viewMonth, -1))}>‹</button>
                        <div className="monthLabel">{monthLabel}</div>
                        <button type="button" className="navBtn" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>›</button>
                    </div>

                    <div className="actions">
                        <button type="button" className="btn" onClick={() => { loadRanking(); loadCalendar(); }}>
                            새로고침
                        </button>
                    </div>
                </div>

                <div className="hint">
                    랭킹은 <b>유효 벙(4+)</b>만 카운트 / 캘린더는 <b>유효+비유효 모두 표시</b>
                </div>
            </div>

            <div className="layout">
                <section className="card">
                    <div className="secTitle">랭킹 (유효 벙 참여)</div>

                    {rankErr && <div className="err">오류: {rankErr}</div>}

                    {summary && (
                        <div className="sum">
                            <div className="sumBox">총 벙: <b>{summary.total_bungs}</b></div>
                            <div className="sumBox">유효 벙: <b>{summary.valid_bungs}</b></div>
                        </div>
                    )}

                    <div className="tbl">
                        <div className="tr th">
                            <div>#</div>
                            <div>이름</div>
                            <div className="r">횟수</div>
                        </div>

                        {(rankLoading ? [] : rankings).map((r, i) => (
                            <button
                                key={r.member_id}
                                type="button"
                                className="tr"
                                onClick={() => openMemberModal(r)}
                            >
                                <div>{i + 1}</div>
                                <div className="name">{r.name}</div>
                                <div className="r">{r.valid_count}</div>
                            </button>
                        ))}

                        {rankLoading && <div className="muted">불러오는 중...</div>}
                        {!rankLoading && rankings.length === 0 && <div className="muted">데이터가 없습니다.</div>}
                    </div>
                </section>

                <section className="card">
                    <div className="secTitle">캘린더</div>
                    {calErr && <div className="err">오류: {calErr}</div>}
                    {calLoading && <div className="muted">불러오는 중...</div>}

                    <BungCalendar
                        year={viewMonth.getFullYear()}
                        monthIndex={viewMonth.getMonth()}
                        calendarDays={calendarDays}
                        onClickDay={(dateKey) => openDayModal(dateKey)}
                    />
                </section>
            </div>

            <Modal
                open={dayOpen}
                title={dayKey ? `${dayKey} 벙 상세` : "날짜 상세"}
                onClose={() => setDayOpen(false)}
            >
                {dayErr && <div className="err">오류: {dayErr}</div>}
                {dayLoading && <div className="muted">불러오는 중...</div>}

                {!dayLoading && dayData?.bungs?.length === 0 && <div className="muted">해당 날짜의 벙이 없습니다.</div>}

                {!dayLoading && dayData?.bungs?.length > 0 && (
                    <div className="list">
                        {dayData.bungs.map((b) => (
                            <div key={b.bung_id} className={`bungBox ${b.is_valid ? "bValid" : "bInvalid"}`}>
                                <div className="bungHead">
                                    <div className="bungLeft">
                                        <span className="badge">{b.is_valid ? "✓ 유효" : "! 비유효"}</span>
                                        <span className="time">{fmtTime(b.bung_at)}</span>
                                        <span className="meta">{b.attendee_count}명</span>
                                    </div>
                                    <div className="bungRight">
                                        {b.title ? <span className="meta">{b.title}</span> : null}
                                        {b.center_name ? <span className="meta">· {b.center_name}</span> : null}
                                    </div>
                                </div>

                                <div className="names">
                                    {(b.attendees || []).map((a) => a.name).join(", ") || "참석자 없음"}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>

            <Modal
                open={memberOpen}
                title={member?.name ? `${member.name} 참여 벙` : "멤버 상세"}
                onClose={() => setMemberOpen(false)}
            >
                {memberErr && <div className="err">오류: {memberErr}</div>}
                {memberLoading && <div className="muted">불러오는 중...</div>}

                {!memberLoading && memberData?.items?.length === 0 && (
                    <div className="muted">참여 기록이 없습니다.</div>
                )}

                {!memberLoading && memberData?.items?.length > 0 && (
                    <div className="tbl2">
                        <div className="tr2 th2">
                            <div>일시</div>
                            <div className="c">상태</div>
                            <div className="r">인원</div>
                        </div>

                        {memberData.items.map((it) => (
                            <div key={it.bung_id} className={`tr2 ${it.is_valid ? "v" : "iv"}`}>
                                <div className="t1">
                                    <div className="dt">{new Date(it.bung_at).toLocaleString("ko-KR")}</div>
                                    <div className="sub">
                                        {it.title || "(제목 없음)"}{it.center_name ? ` · ${it.center_name}` : ""}
                                    </div>
                                </div>
                                <div className="c">{it.is_valid ? "✓" : "!"}</div>
                                <div className="r">{it.attendee_count}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>

            <style jsx>{`
        .wrap {
          max-width: 980px;
          margin: 0 auto;
          padding: 16px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto;
        }
        .h1 { margin: 0 0 10px 0; }

        .card {
          border: 1px solid #eee;
          border-radius: 16px;
          padding: 12px;
          background: white;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          align-items: center;
        }
        @media (min-width: 900px) {
          .row { grid-template-columns: 1fr auto auto; }
        }

        .seg { display: flex; gap: 6px; flex-wrap: wrap; }
        .segBtn {
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
        }
        .segOn {
          border-color: #111;
          background: #111;
          color: white;
        }

        .monthNav { display: flex; gap: 10px; align-items: center; justify-content: center; }
        .navBtn {
          width: 40px; height: 36px;
          border-radius: 12px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          font-size: 18px;
        }
        .monthLabel { font-weight: 900; min-width: 90px; text-align: center; }

        .actions { display: flex; justify-content: flex-end; }
        .btn {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
        }

        .hint { margin-top: 8px; color: #666; font-size: 13px; }

        .layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        @media (min-width: 900px) {
          .layout { grid-template-columns: 360px 1fr; align-items: start; }
        }

        .secTitle { font-weight: 900; margin-bottom: 10px; }

        .sum { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
        .sumBox { border: 1px solid #eee; border-radius: 14px; padding: 8px 10px; background: #fafafa; }

        .tbl { border: 1px solid #eee; border-radius: 14px; overflow: hidden; }
        .tr {
          display: grid;
          grid-template-columns: 50px 1fr 70px;
          gap: 8px;
          padding: 10px;
          border-bottom: 1px solid #eee;
          background: white;
          text-align: left;
          cursor: pointer;
          border: none;
        }
        .th { background: #fafafa; font-weight: 900; cursor: default; }
        .name { font-weight: 900; }
        .r { text-align: right; }

        .muted { color: #666; padding: 10px 2px; }
        .err { color: #b00020; padding: 10px 2px; }

        .list { display: grid; gap: 10px; }
        .bungBox {
          border: 2px solid #e6e6e6;
          border-radius: 14px;
          padding: 10px;
          background: white;
        }
        .bValid { border-color: #28a745; }
        .bInvalid { border-color: #dc3545; }

        .bungHead { display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; }
        .bungLeft { display:flex; gap:8px; align-items:center; }
        .badge { font-weight: 900; }
        .time { font-weight: 900; }
        .meta { color: #666; font-size: 13px; }
        .names { margin-top: 8px; line-height: 1.45; }

        .tbl2 { border: 1px solid #eee; border-radius: 14px; overflow: hidden; }
        .tr2 { display: grid; grid-template-columns: 1fr 60px 60px; gap: 8px; padding: 10px; border-bottom: 1px solid #eee; }
        .th2 { background: #fafafa; font-weight: 900; }
        .c { text-align: center; }
        .dt { font-weight: 900; }
        .sub { color: #666; font-size: 13px; margin-top: 2px; }
        .v { border-left: 4px solid #28a745; }
        .iv { border-left: 4px solid #dc3545; }

        @media (max-width: 480px) {
          .wrap { padding: 12px; }
          .tr { grid-template-columns: 44px 1fr 60px; padding: 9px; }
        }
      `}</style>
        </div>
    );
}
