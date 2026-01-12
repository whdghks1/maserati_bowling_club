// pages/team.js
import { useEffect, useMemo, useState } from "react";
import styles from "../src/TeamPage.module.css";

// Fisher–Yates
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomIndex(n) {
  return Math.floor(Math.random() * n);
}

/**
 * participants: [{ id, name, level, average, ... }]
 * seed1Ids: number[]  (팀 수를 결정하는 1시드 참가자 IDs)
 *
 * 팀 구성:
 * - teamCount = seed1Ids.length
 * - 각 팀은 { members: [] }
 * - 1시드부터 각 팀에 1명씩 배치
 * - 그 다음 레벨(2..n)별로 팀에 1명씩 round-robin 배치 (가능한 한 같은 레벨 중복 없이)
 * - 어떤 레벨이 teamCount보다 많으면 남는 애들은 랜덤 팀에 추가
 */
function buildTeamsBySeeds(participants, seed1Ids) {
  const teamCount = seed1Ids.length;
  if (teamCount <= 0) return [];

  const byId = new Map(participants.map((p) => [p.id, p]));

  const seed1 = seed1Ids.map((id) => byId.get(id)).filter(Boolean);
  const others = participants.filter((p) => !seed1Ids.includes(p.id));

  // 레벨별 그룹핑 (level=시드)
  const bucket = new Map();
  for (const p of others) {
    const k = p.level ?? 0;
    if (!bucket.has(k)) bucket.set(k, []);
    bucket.get(k).push(p);
  }

  // 레벨 오름차순(= 2시드부터)로 처리
  const seedLevels = Array.from(bucket.keys()).sort((a, b) => a - b);

  const teams = Array.from({ length: teamCount }, (_, i) => ({
    teamNo: i + 1,
    members: [],
    seedLevelsInTeam: new Set(),
  }));

  // 1시드 배치 (팀당 1명)
  shuffle(seed1).forEach((p, idx) => {
    const t = teams[idx % teamCount];
    t.members.push(p);
    t.seedLevelsInTeam.add(p.level);
  });

  // 2시드부터 순차 배치
  for (const lvl of seedLevels) {
    const list = shuffle(bucket.get(lvl) || []);

    // 먼저 “중복 레벨 없이” round-robin으로 가능한 만큼 배치
    let cursor = 0;
    for (const p of list) {
      // 중복 레벨이 없는 팀을 찾는다
      let placed = false;
      for (let tries = 0; tries < teamCount; tries++) {
        const t = teams[(cursor + tries) % teamCount];
        if (!t.seedLevelsInTeam.has(lvl)) {
          t.members.push(p);
          t.seedLevelsInTeam.add(lvl);
          cursor = (cursor + tries + 1) % teamCount;
          placed = true;
          break;
        }
      }
      if (!placed) {
        // 모든 팀이 이미 lvl을 가지고 있으면 랜덤 팀에 추가
        const t = teams[pickRandomIndex(teamCount)];
        t.members.push(p);
      }
    }
  }

  // 정리: 내부용 필드 제거
  return teams.map((t) => ({
    teamNo: t.teamNo,
    members: t.members,
  }));
}

export default function TeamPage() {
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersErr, setMembersErr] = useState("");

  // 참가자 선택
  const [selectedIds, setSelectedIds] = useState(new Set());

  // 1시드(팀 수 결정) 직접 선택
  const [seed1Ids, setSeed1Ids] = useState(new Set());

  // 결과
  const [teams, setTeams] = useState([]);
  const [making, setMaking] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingMembers(true);
      setMembersErr("");
      try {
        const res = await fetch("/api/members");
        if (!res.ok) throw new Error(`members fetch failed: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setMembers(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setMembersErr(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const participants = useMemo(() => {
    return members.filter((m) => selectedIds.has(m.id));
  }, [members, selectedIds]);

  const seed1List = useMemo(() => {
    return Array.from(seed1Ids);
  }, [seed1Ids]);

  function toggleSet(setter, id) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function makeTeams() {
    setMsg("");
    const p = participants;
    if (p.length === 0) {
      setMsg("참가자를 선택해주세요.");
      return;
    }
    const s1 = seed1List.filter((id) => selectedIds.has(id));
    if (s1.length === 0) {
      setMsg("1시드(팀 수 결정)를 선택해주세요.");
      return;
    }
    if (s1.length > p.length) {
      setMsg("1시드 인원이 참가자 수보다 많을 수 없습니다.");
      return;
    }

    setMaking(true);

    // “돌아가는 연출” (진짜 점점 느려짐) - setTimeout 재귀
    const total = 14;
    let step = 0;

    const tick = () => {
      step += 1;
      const t = buildTeamsBySeeds(p, s1);
      setTeams(t);

      if (step >= total) {
        setMaking(false);
        return;
      }

      const delay = 120 + step * 70 + Math.floor(step * step * 5);
      setTimeout(tick, delay);
    };

    tick();
  }

  const disabled = making || loadingMembers;

  return (
    <div className={styles.teamPage}>
      <h1 className={styles.pageTitle}>팀 편성 페이지</h1>

      {membersErr && <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5", borderRadius: 8 }}>{membersErr}</div>}
      {msg && <div style={{ padding: 12, border: "1px solid #f2c2c2", background: "#fff5f5", borderRadius: 8 }}>{msg}</div>}

      <div style={{ marginBottom: 10, color: "#666" }}>
        1) <b>참가자 선택</b> → 2) <b>1시드 선택(팀 수)</b> → 3) 팀 편성
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>등록된 인원 (체크해서 참가자 선택)</h2>
          {loadingMembers ? (
            <div style={{ padding: 10, color: "#666" }}>불러오는 중...</div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
              {members.map((m) => (
                <label key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m.id)}
                    onChange={() => {
                      toggleSet(setSelectedIds, m.id);
                      // 참가자에서 빠지면 1시드에서도 자동 제거
                      setSeed1Ids((prev) => {
                        const next = new Set(prev);
                        if (next.has(m.id) && selectedIds.has(m.id)) {
                          // 이미 선택중이었는데 지금 해제되는 경우 (selectedIds는 아직 prev)
                          next.delete(m.id);
                        }
                        return next;
                      });
                    }}
                  />
                  <div style={{ lineHeight: 1.25 }}>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div style={{ color: "#666" }}>{m.level}레벨 · 에버 {m.average}</div>
                    <div style={{ color: "#999", fontSize: 12 }}>참여 {m.games_played} · 총핀 {m.total_pins}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>1시드 선택 (팀 수 = 1시드 인원수)</h2>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {participants.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleSet(setSeed1Ids, p.id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: seed1Ids.has(p.id) ? "1px solid #111" : "1px solid #ddd",
                  background: seed1Ids.has(p.id) ? "#111" : "white",
                  color: seed1Ids.has(p.id) ? "white" : "#111",
                  cursor: "pointer",
                }}
              >
                {p.name}
              </button>
            ))}
            {participants.length === 0 && <div style={{ color: "#666" }}>참가자를 먼저 선택하세요.</div>}
          </div>
        </section>

        <div>
          <button type="button" disabled={disabled} className={styles.submitButton} onClick={makeTeams}>
            {making ? "팀 편성 중..." : "팀 편성 시작"}
          </button>
          <div style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
            팀 수는 1시드 인원수로 결정. 같은 레벨이 한 팀에 중복되면(인원이 많을 때) 랜덤으로 들어갈 수 있어.
          </div>
        </div>

        {/* 결과 */}
        {teams.length > 0 && (
          <section style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>팀 결과</h2>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
              {teams.map((t) => (
                <div key={t.teamNo} className={making ? styles.teamContainerBlur : styles.teamContainer}>
                  <h3 className={styles.teamTitle}>팀 {t.teamNo}</h3>
                  <p className={styles.teamMember}>
                    {t.members.map((m) => `${m.name}(${m.level})`).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
