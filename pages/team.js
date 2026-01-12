import { useMemo, useRef, useState } from "react";
import styles from "../src/TeamPage.module.css";

/**
 * TODO(나중에): DB에서 불러오면 됨
 * 지금은 임시로 하드코딩. (원하면 빈 배열로 두고, 아래 input으로 직접 추가하는 UI도 만들 수 있음)
 */
const ALL_MEMBERS = [
  "박종환", "김민수", "김진우", "문현경", "김지영", "최종서", "김진규", "정유나", "박진종", "박지환", "박정환", "김수빈", "이건무", "유희선", "박정우", "정미라",
  "김선동", "박원주", "정승민","유병진","홍정화","강하람","김예권","김우림","조성우","류예진","변성준","정들림","서영제","박기현","김기혁","조윤형","박태원","김미경"
,"최예빈","임상균","전성민","유병능","박정선","오용석","김준규","이창훈","장인경","김미현","장태진","황석주","김동의","온소정","이성룡","조세훈","김태성","남보라","임형택","양승리"];

function uniqClean(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
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
 * seedPools: { seedKey: [names...] }  (seed1은 팀장)
 * teamCount: seed1(팀장) 수
 *
 * 규칙:
 * - 팀 수 = 1시드(팀장) 수
 * - 1시드는 각 팀의 leader
 * - 나머지 시드는 가능한 한 "한 팀에 같은 시드 1명" 원칙으로 round-robin 배치
 * - 어떤 시드 인원이 팀 수보다 많으면: 초과분은 랜덤 팀에 추가 배정(같은 시드 중복 허용)
 */
function buildTeams(seedPools, teamCount) {
  const seedKeys = Object.keys(seedPools)
    .sort((a, b) => Number(a.replace("seed", "")) - Number(b.replace("seed", "")));

  const leaders = seedPools.seed1 || [];
  const teams = leaders.slice(0, teamCount).map((leader) => ({
    leader,
    members: [],
    seeds: { seed1: leader },
  }));

  // seed2+ 배정
  for (const key of seedKeys) {
    if (key === "seed1") continue;
    const pool = seedPools[key] || [];
    if (!pool.length) continue;

    // 1) 한 팀에 1명씩 최대 teamCount까지 round-robin
    const firstBatch = pool.slice(0, teamCount);
    const rest = pool.slice(teamCount);

    const shuffledFirst = fisherYates(firstBatch);
    for (let i = 0; i < shuffledFirst.length; i++) {
      const t = teams[i];
      t.members.push(shuffledFirst[i]);
      t.seeds[key] = (t.seeds[key] || []).concat([shuffledFirst[i]]);
    }

    // 2) 초과분은 랜덤 팀에 넣음(같은 시드 중복 가능)
    const shuffledRest = fisherYates(rest);
    for (const name of shuffledRest) {
      const idx = Math.floor(Math.random() * teams.length);
      teams[idx].members.push(name);
      tSafePushSeed(teams[idx], key, name);
    }
  }

  return teams;

  function tSafePushSeed(team, key, name) {
    if (!team.seeds[key]) team.seeds[key] = [];
    if (Array.isArray(team.seeds[key])) team.seeds[key].push(name);
    else team.seeds[key] = [name];
  }
}

export default function TeamPage() {
  // seedInputs: {seed1: [names], seed2: [names] ...}
  const [seedCount, setSeedCount] = useState(2); // 기본: 1~2시드
  const [seedPools, setSeedPools] = useState({
    seed1: [],
    seed2: [],
  });

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);

  // 연출 속도: 빠르게!
  const TOTAL_ITER = 10;        // 이전 15 → 10 (빠름)
  const BASE_DELAY = 40;        // 200 → 40
  const STEP_DELAY = 10;        // 40 → 10 (아주 조금만 느려짐)

  const timerRef = useRef(null);

  const allOptions = useMemo(() => uniqClean(ALL_MEMBERS), []);

  const teamCount = (seedPools.seed1 || []).length;

  function ensureSeedCount(nextCount) {
    setSeedCount(nextCount);

    setSeedPools((prev) => {
      const next = { ...prev };
      for (let i = 1; i <= nextCount; i++) {
        const k = `seed${i}`;
        if (!next[k]) next[k] = [];
      }
      // 줄였으면 뒤 시드는 버림(원하면 유지하게 바꿀 수도 있음)
      for (let i = nextCount + 1; ; i++) {
        const k = `seed${i}`;
        if (!(k in next)) break;
        delete next[k];
      }
      return next;
    });
  }

  function togglePick(seedKey, name) {
    setSeedPools((prev) => {
      const current = prev[seedKey] || [];
      const exists = current.includes(name);
      const nextArr = exists ? current.filter((n) => n !== name) : current.concat(name);
      return { ...prev, [seedKey]: nextArr };
    });
  }

  function clearAll() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLoading(false);
    setTeams([]);
  }

  function startShuffle() {
    clearAll();

    // 유효성 검사
    const leaders = seedPools.seed1 || [];
    if (leaders.length === 0) {
      alert("1시드(팀장)를 최소 1명 선택해주세요.");
      return;
    }

    setLoading(true);

    let counter = 0;
    const loop = () => {
      counter++;

      // 매번 seed별로 섞어서 팀 생성 (연출)
      const shuffledPools = {};
      for (const [k, v] of Object.entries(seedPools)) {
        shuffledPools[k] = fisherYates(uniqClean(v));
      }

      const nextTeams = buildTeams(shuffledPools, teamCount);
      setTeams(nextTeams);

      if (counter >= TOTAL_ITER) {
        setLoading(false);
        timerRef.current = null;
        return;
      }

      const delay = BASE_DELAY + counter * STEP_DELAY; // 점점 살짝 느려짐
      timerRef.current = setTimeout(loop, delay);
    };

    timerRef.current = setTimeout(loop, BASE_DELAY);
  }

  const seedKeys = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= seedCount; i++) arr.push(`seed${i}`);
    return arr;
  }, [seedCount]);

  return (
    <div className={styles.teamPage}>
      <h1 className={styles.pageTitle}>팀 편성 페이지</h1>

      {/* 시드 개수 */}
      <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>시드 개수:</div>
        <select
          value={seedCount}
          onChange={(e) => ensureSeedCount(Number(e.target.value))}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
          disabled={loading}
        >
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n} 시드</option>
          ))}
        </select>

        <div style={{ marginLeft: "auto", color: "#666" }}>
          팀 수 = 1시드(팀장) {teamCount}명
        </div>
      </div>

      {/* 시드별 선택 */}
      <div className={styles.form}>
        {seedKeys.map((seedKey) => {
          const isLeaders = seedKey === "seed1";
          const picked = seedPools[seedKey] || [];
          return (
            <div key={seedKey} className={styles.inputLabel} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>
                  {isLeaders ? "1시드 (팀장)" : `${seedKey.replace("seed", "")}시드`}
                </div>
                <div style={{ color: "#666" }}>
                  선택: {picked.length}명
                </div>
              </div>

              {/* 드롭다운(멀티 선택) */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <details style={{ width: "100%" }}>
                  <summary style={{ cursor: "pointer", padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, background: "#fff" }}>
                    {isLeaders ? "팀장(1시드) 선택하기" : `${seedKey.replace("seed", "")}시드 인원 선택하기`}
                  </summary>

                  <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 8, marginTop: 8, background: "#fafafa" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                      {allOptions.map((name) => {
                        const checked = picked.includes(name);
                        return (
                          <label key={name} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePick(seedKey, name)}
                              disabled={loading}
                            />
                            <span>{name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </details>

                {/* 선택된 인원 미리보기 */}
                {picked.length > 0 && (
                  <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 6 }}>
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
            </div>
          );
        })}

        <button
          type="button"
          className={styles.submitButton}
          onClick={startShuffle}
          disabled={loading}
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "팀 편성 중..." : "팀 편성 시작"}
        </button>

        <button
          type="button"
          onClick={clearAll}
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
      </div>

      {/* 결과 */}
      {teams.map((team, index) => (
        <div
          key={index}
          className={loading ? styles.teamContainerBlur : styles.teamContainer}
        >
          <h3 className={styles.teamTitle}>팀 {index + 1}</h3>
          <p className={styles.teamMember}>팀장(1시드): {team.leader}</p>
          <p className={styles.teamMember}>팀원: {team.members.join(", ")}</p>
        </div>
      ))}
    </div>
  );
}
