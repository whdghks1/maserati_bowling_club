import { useState } from 'react';
import styles from '../src/TeamPage.module.css';

export default function TeamPage() {
  const [leadersInput, setLeadersInput] = useState('');
  const [membersInput, setMembersInput] = useState('');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false); // 추가된 부분: 로딩 상태

  const handleLeadersInputChange = (event) => {
    setLeadersInput(event.target.value);
  };

  const handleMembersInputChange = (event) => {
    setMembersInput(event.target.value);
  };

  const shuffleArray = (array) => {
    const shuffled = array.slice(); // 배열 복사
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // 값 교환
    }
    return shuffled;
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();

    setLoading(true); // 팀 편성 시작 시 로딩 시작

    const leaders = leadersInput.split(',').map(name => name.trim());
    const members = membersInput.split(',').map(name => name.trim());

    // 유효성 검사
    if (leaders.length === 0 || members.length === 0) {
      console.error('팀장과 팀원의 이름을 입력해야 합니다.');
      setLoading(false); // 오류 발생 시 로딩 종료
      return;
    }

    const teamCount = leaders.length;

    // 팀원이 부족한 경우 처리
    if (members.length < teamCount) {
      console.error('입력된 팀원 수가 팀 수보다 적습니다. 더 많은 팀원을 입력해주세요.');
      setLoading(false); // 오류 발생 시 로딩 종료
      return;
    }

    const shuffledMembers = shuffleArray(members);
    const membersPerTeam = Math.floor(shuffledMembers.length / teamCount);
    const remainingMembers = shuffledMembers.length % teamCount;

    let newTeams = []; // 팀 배열 초기화

    let counter = 0;
    const totalIterations = 15; // 총 반복 횟수

    const interval = setInterval(() => {
      counter++;

      // 매 반복마다 팀원을 다시 섞음
      const newShuffledMembers = shuffleArray(members.slice());

      // 새로운 팀을 담을 배열
      const newTeams = [];

      let currentIndex = 0;
      for (let i = 0; i < teamCount; i++) {
        const team = {
          leader: leaders[i],
          members: [],
        };

        let membersToAdd = membersPerTeam;
        if (i < remainingMembers) {
          membersToAdd++;
        }

        // 매 반복마다 새로운 셔플된 팀원을 사용하여 팀 구성
        for (let j = 0; j < membersToAdd; j++) {
          team.members.push(newShuffledMembers[currentIndex]);
          currentIndex++;
        }

        newTeams.push(team); // 새로운 팀을 추가
      }

      setTeams(newTeams);
      console.log(newTeams);

      if (counter === totalIterations) { // 총 반복 횟수에 도달하면 로딩 종료
        clearInterval(interval);
        setLoading(false);
      }
    }, 200 + counter * 40);
  };
  
  return (
    <div className={styles.teamPage}>
      <h1 className={styles.pageTitle}>팀 편성 페이지</h1>
      <form onSubmit={handleFormSubmit} className={styles.form}>
        <label className={styles.inputLabel}>
          팀장 이름(쉼표로 구분):
          <textarea
            className={styles.textArea}
            rows={4}
            cols={50}
            value={leadersInput}
            onChange={handleLeadersInputChange}
          />
        </label>
        <br />
        <label className={styles.inputLabel}>
          팀원 이름(쉼표로 구분):
          <textarea
            className={styles.textArea}
            rows={8}
            cols={50}
            value={membersInput}
            onChange={handleMembersInputChange}
          />
        </label>
        <br />
        <button type="submit" className={styles.submitButton}>팀 편성 시작</button>
      </form>

      {/* 팀 편성 결과 출력 */}
      {teams.map((team, index) => (
        <div
          key={index}
          className={loading ? styles.teamContainerBlur : styles.teamContainer}
        >
          <h3 className={styles.teamTitle}>팀 {index + 1}</h3>
          <p className={styles.teamMember}>팀장: {team.leader}</p>
          <p className={styles.teamMember}>팀원: {team.members.join(', ')}</p>
        </div>
      ))}
    </div>
  );
}
