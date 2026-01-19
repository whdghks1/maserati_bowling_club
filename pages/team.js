import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../src/TeamPage.module.css";

// localStorage keys
const LS_SEED_COUNT = "bowling:team:seedCount";
const LS_SEED_POOLS = "bowling:team:seedPools";

function uniqClean(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    const v = String(x || "").trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function fisherYates(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * seedPools: { seed1: [names], seed2: [names], ... }
 * teamCount: seed1(팀장) 수
 *
 * 규칙:
 * - 팀 수 = 1시드(팀장) 수
 * - seed2+는 가능한 "각 팀에 해당 시드 1명" 원칙으로 round-robin
 * - 해당 시드 인원이 팀 수보다 많으면 초과분은 랜덤 팀에 추가(같은 시드 중복 가능)
 */
function buildTeams(seedPools, teamCount) {
  const seedKeys = Object.keys(seedPools).sort(
    (a, b) => Number(a.replace("seed", "")) - Number(b.replace("seed", ""))
  );

  const leaders = seedPools.seed1 || [];
  const teams = leaders.slice(0, teamCount).map((leader) => ({
    leader,
    members: [],
  }));

  for (const key of seedKeys) {
    if (key === "seed1") continue;

    const pool = seedPools[key] || [];
    if (!pool.length) continue;

    // ✅ 공정 셔플
    const shuffled = fisherYates(pool);

    // ✅ 균등 배분: 라운드로빈(팀별 인원수 차이 최대 1)
    const start = Math.floor(Math.random() * teamCount); // 매번 시작팀 랜덤(편향 방지)
    for (let i = 0; i < shuffled.length; i++) {
      const teamIndex = (start + i) % teamCount;
      teams[teamIndex].members.push(shuffled[i]);
    }
  }

  return teams;
}

function makeSeedKeys(count) {
  const keys = [];
  for (let i = 1; i <= count; i++) keys.push(`seed${i}`);
  return keys;
}

function normalizePools(pools, seedCount) {
  const next = {};
  const keys = makeSeedKeys(seedCount);
  for (const k of keys) next[k] = uniqClean(pools?.[k] || []);
  return next;
}

function seedLabel(seedKey) {
  const n = Number(seedKey.replace("seed", ""));
  return n === 1 ? "1시드 (팀장)" : `${n}시드`;
}

function formatTeamsText(teams) {
  // 카톡/메모에 붙이기 좋게
  return teams
    .map((t, i) => {
      const members = t.members.length ? ` / 팀원: ${t.members.join(", ")}` : "";
      return `팀 ${i + 1} - 팀장: ${t.leader}${members}`;
    })
    .join("\n");
}

async function copyToClipboard(text) {
  // modern
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // fallback
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export default function TeamPage() {
  // 🔥 속도(빠르게)
  const TOTAL_ITER = 10;
  const BASE_DELAY = 35;
  const STEP_DELAY = 8;

  const timerRef = useRef(null);

  // 멤버 목록(DB)
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState("");

  // seed state (localStorage 복원)
  const [seedCount, setSeedCount] = useState(2);
  const [seedPools, setSeedPools] = useState({ seed1: [], seed2: [] });

  // ✅ 시드별 검색어
  const [seedSearch, setSeedSearch] = useState({ seed1: "", seed2: "" });

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState("");

  const teamCount = (seedPools.seed1 || []).length;
  const seedKeys = useMemo(() => makeSeedKeys(seedCount), [seedCount]);

  // ✅ “어느 시드에 들어가있는지” 빠르게 찾기 위한 맵
  // name -> seedKey
  const nameToSeed = useMemo(() => {
    const map = new Map();
    for (const k of Object.keys(seedPools)) {
      for (const name of seedPools[k] || []) {
        map.set(name, k);
      }
    }
    return map;
  }, [seedPools]);

  // 1) DB에서 members 불러오기
  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      setMembersLoading(true);
      setMembersError("");
      try {
        const res = await fetch("/api/members"); 
        if (!res.ok) throw new Error(`members fetch failed: ${res.status}`);
        const data = await res.json();
        const names = Array.isArray(data) ? data.map((r) => r?.name).filter(Boolean) : [];
        if (!cancelled) setMembers(uniqClean(names));
      } catch (e) {
        if (!cancelled) setMembersError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    }

    loadMembers();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) localStorage에서 seedCount / seedPools 복원
  useEffect(() => {
    try {
      const savedCountRaw = localStorage.getItem(LS_SEED_COUNT);
      const savedPoolsRaw = localStorage.getItem(LS_SEED_POOLS);

      const parsedCount = savedCountRaw ? Number(savedCountRaw) : 2;
      const nextCount = Number.isFinite(parsedCount) && parsedCount >= 2 ? parsedCount : 2;

      const parsedPools = savedPoolsRaw ? JSON.parse(savedPoolsRaw) : null;

      setSeedCount(nextCount);
      setSeedPools(normalizePools(parsedPools || {}, nextCount));

      // 검색 상태도 맞춰줌
      setSeedSearch((prev) => {
        const next = {};
        for (const k of makeSeedKeys(nextCount)) next[k] = prev?.[k] ?? "";
        return next;
      });
    } catch {
      // ignore
    }
  }, []);

  // 3) seedCount/seedPools 변경 시 저장
  useEffect(() => {
    try {
      localStorage.setItem(LS_SEED_COUNT, String(seedCount));
      localStorage.setItem(LS_SEED_POOLS, JSON.stringify(seedPools));
    } catch {
      // ignore
    }
  }, [seedCount, seedPools]);

  function ensureSeedCount(nextCount) {
    clearShuffleOnly();
    setSeedCount(nextCount);
    setSeedPools((prev) => normalizePools(prev, nextCount));
    setSeedSearch((prev) => {
      const next = {};
      for (const k of makeSeedKeys(nextCount)) next[k] = prev?.[k] ?? "";
      return next;
    });
  }

  function togglePick(seedKey, name) {
    setSeedPools((prev) => {
      const next = { ...prev };
      const current = next[seedKey] || [];
      const has = current.includes(name);

      if (has) {
        next[seedKey] = current.filter((n) => n !== name);
        return next;
      }

      // ✅ 체크 시: 다른 모든 시드에서 제거 후 현재 시드에만 추가 (중복 방지)
      for (const k of Object.keys(next)) {
        next[k] = (next[k] || []).filter((n) => n !== name);
      }
      next[seedKey] = uniqClean([...(next[seedKey] || []), name]);
      return next;
    });
  }

  function clearShuffleOnly() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLoading(false);
    setTeams([]);
    setCopiedMsg("");
  }

  function startShuffle() {
    clearShuffleOnly();

    const leaders = seedPools.seed1 || [];
    if (leaders.length === 0) {
      alert("1시드(팀장)를 최소 1명 선택해주세요.");
      return;
    }

    setLoading(true);

    let counter = 0;
    const loop = () => {
      counter++;

      // 매번 seed별로 셔플해서 연출
      const shuffledPools = {};
      for (const [k, v] of Object.entries(seedPools)) {
        shuffledPools[k] = fisherYates(uniqClean(v));
      }

      const nextTeams = buildTeams(shuffledPools, leaders.length);
      setTeams(nextTeams);

      if (counter >= TOTAL_ITER) {
        setLoading(false);
        timerRef.current = null;
        return;
      }

      const delay = BASE_DELAY + counter * STEP_DELAY; // 점점 느려지게
      timerRef.current = setTimeout(loop, delay);
    };

    timerRef.current = setTimeout(loop, BASE_DELAY);
  }

  function resetSelections() {
    clearShuffleOnly();
    setSeedPools(normalizePools({}, seedCount));
  }

  async function onCopyTeams() {
    try {
      const text = formatTeamsText(teams);
      await copyToClipboard(text);
      setCopiedMsg("복사 완료! (카톡/메모에 붙여넣기 가능)");
      setTimeout(() => setCopiedMsg(""), 1800);
    } catch (e) {
      alert("복사 실패: " + String(e?.message ?? e));
    }
  }

  return (
    <div className={styles.teamPage}>
      <h1 className={styles.pageTitle}>팀 편성 페이지</h1>

      {membersError && (
        <div
          style={{
            padding: 12,
            border: "1px solid #f2c2c2",
            background: "#fff5f5",
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          멤버 불러오기 실패: {membersError}
        </div>
      )}

      <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>시드 개수:</div>
        <select
          value={seedCount}
          onChange={(e) => ensureSeedCount(Number(e.target.value))}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
          disabled={loading}
        >
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} 시드
            </option>
          ))}
        </select>

        <div style={{ marginLeft: "auto", color: "#666" }}>
          팀 수 = 1시드(팀장) {teamCount}명
        </div>
      </div>

      <div className={styles.form}>
        {seedKeys.map((seedKey) => {
          const isLeaders = seedKey === "seed1";
          const picked = seedPools[seedKey] || [];

          const q = (seedSearch[seedKey] || "").trim().toLowerCase();
          const filteredMembers = q
            ? members.filter((n) => n.toLowerCase().includes(q))
            : members;

          return (
            <div key={seedKey} className={styles.inputLabel} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>{seedLabel(seedKey)}</div>
                <div style={{ color: "#666" }}>선택: {picked.length}명</div>
              </div>

              {/* ✅ 검색창 */}
              <input
                type="text"
                placeholder="이름 검색..."
                value={seedSearch[seedKey] || ""}
                onChange={(e) => setSeedSearch((prev) => ({ ...prev, [seedKey]: e.target.value }))}
                disabled={loading || membersLoading}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  marginBottom: 8,
                }}
              />

              <details style={{ width: "100%" }}>
                <summary
                  style={{
                    cursor: membersLoading ? "not-allowed" : "pointer",
                    padding: "10px 12px",
                    border: "1px solid #ccc",
                    borderRadius: 8,
                    background: "#fff",
                    opacity: membersLoading ? 0.6 : 1,
                  }}
                >
                  {membersLoading
                    ? "멤버 불러오는 중..."
                    : isLeaders
                      ? "팀장(1시드) 선택하기"
                      : `${seedKey.replace("seed", "")}시드 인원 선택하기`}
                </summary>

                <div
                  style={{
                    padding: 10,
                    border: "1px solid #eee",
                    borderRadius: 8,
                    marginTop: 8,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    {filteredMembers.map((name) => {
                      const checked = picked.includes(name);

                      // ✅ 다른 시드에 이미 선택된 사람은 “여기서는 선택 불가(비활성화)”
                      const alreadySeed = nameToSeed.get(name); // e.g. seed2
                      const disabledByOtherSeed = alreadySeed && alreadySeed !== seedKey;

                      return (
                        <label key={name} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePick(seedKey, name)}
                            disabled={loading || membersLoading || disabledByOtherSeed}
                          />
                          <span style={{ opacity: disabledByOtherSeed ? 0.5 : 1 }}>
                            {name}
                            {disabledByOtherSeed ? (
                              <em style={{ marginLeft: 8, color: "#888", fontStyle: "normal" }}>
                                ({seedLabel(alreadySeed)})
                              </em>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </details>

              {picked.length > 0 && (
                <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {picked.map((n) => (
                    <span
                      key={n}
                      style={{
                        border: "1px solid #ddd",
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "white",
                      }}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className={styles.submitButton}
          onClick={startShuffle}
          disabled={loading || membersLoading}
          style={{ opacity: loading || membersLoading ? 0.6 : 1 }}
        >
          {loading ? "팀 편성 중..." : "팀 편성 시작"}
        </button>

        <button
          type="button"
          onClick={clearShuffleOnly}
          disabled={loading}
          style={{
            marginTop: 10,
            padding: "10px 20px",
            background: "#eee",
            border: "1px solid #ddd",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          결과 지우기
        </button>

        <button
          type="button"
          onClick={resetSelections}
          disabled={loading}
          style={{
            marginTop: 10,
            padding: "10px 20px",
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          선택 초기화(시드 선택 전부 비움)
        </button>

        <div style={{ marginTop: 10, color: "#666", fontSize: 13 }}>
          ✅ 같은 사람은 하나의 시드에만 선택됩니다(다른 시드에서는 비활성화).<br />
          ✅ 시드 선택/개수는 자동 저장됩니다(localStorage).
        </div>
      </div>

      {/* 결과 */}
      {teams.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={onCopyTeams}
            disabled={loading}
            style={{
              padding: "10px 20px",
              background: "#111",
              color: "white",
              border: "1px solid #111",
              borderRadius: 4,
              cursor: loading ? "not-allowed" : "pointer",
              width: "100%",
              marginBottom: 10,
              opacity: loading ? 0.6 : 1,
            }}
          >
            팀 결과 복사
          </button>

          {copiedMsg && (
            <div style={{ padding: 10, borderRadius: 8, background: "#f5fff5", border: "1px solid #c7f2c2", marginBottom: 12 }}>
              {copiedMsg}
            </div>
          )}

          {teams.map((team, index) => (
            <div key={index} className={loading ? styles.teamContainerBlur : styles.teamContainer}>
              <h3 className={styles.teamTitle}>팀 {index + 1}</h3>
              <p className={styles.teamMember}>팀장(1시드): {team.leader}</p>
              <p className={styles.teamMember}>팀원: {team.members.join(", ")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
