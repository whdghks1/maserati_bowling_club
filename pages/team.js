// pages/team.js

import { useState } from 'react';
import styles from '../src/TeamPage.module.css'; // CSS 모듈 import

export default function TeamPage() {
  const [leadersInput, setLeadersInput] = useState('');
  const [membersInput, setMembersInput] = useState('');
  const [teams, setTeams] = useState([]);

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

  const handleFormSubmit = (event) => {
    event.preventDefault();

    const leaders = leadersInput.split(',').map(name => name.trim());
    const members = membersInput.split(',').map(name => name.trim());

    if (leaders.length === 0 || members.length === 0) {
      console.error('팀장과 팀원의 이름을 입력해야 합니다.');
      return;
    }

    const teamCount = leaders.length;

    const shuffledMembers = shuffleArray(members);

    const newTeams = [];
    let currentIndex = 0;
    for (let i = 0; i < teamCount; i++) {
      const team = {
        leader: leaders[i],
        members: [],
      };

      while (team.members.length < Math.floor(shuffledMembers.length / teamCount)) {
        team.members.push(shuffledMembers[currentIndex]);
        currentIndex++;
      }

      newTeams.push(team);
    }

    setTeams(newTeams);
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
        <div key={index} className={styles.teamContainer}>
          <h3 className={styles.teamTitle}>팀 {index + 1}</h3>
          <p className={styles.teamMember}>팀장: {team.leader}</p>
          <p className={styles.teamMember}>팀원: {team.members.join(', ')}</p>
        </div>
      ))}
    </div>
  );
}
