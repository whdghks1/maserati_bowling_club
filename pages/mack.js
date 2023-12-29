// pages/PairingPage.js

import React, { useState } from 'react';
import styles from '../src/mack.module.css'; // CSS 모듈 import

export default function PairingPage() {
  const [namesInput, setNamesInput] = useState('');
  const [groupSizeInput, setGroupSizeInput] = useState('');
  const [pairs, setPairs] = useState([]);
  const [remainder, setRemainder] = useState([]);

  const handleNamesInputChange = (event) => {
    setNamesInput(event.target.value);
  };

  const handleGroupSizeInputChange = (event) => {
    setGroupSizeInput(event.target.value);
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();

    const names = namesInput.split(',').map(name => name.trim());
    const groupSize = parseInt(groupSizeInput);

    if (names.length === 0 || isNaN(groupSize) || groupSize <= 0) {
      console.error('올바른 이름과 숫자를 입력해주세요.');
      return;
    }

    const shuffledNames = names.sort(() => Math.random() - 0.5);

    const paired = [];
    const remainder = [];
    const totalPairs = Math.floor(shuffledNames.length / groupSize);

    for (let i = 0; i < totalPairs * groupSize; i += groupSize) {
      paired.push(shuffledNames.slice(i, i + groupSize));
    }

    if (shuffledNames.length % groupSize !== 0) {
      remainder.push(...shuffledNames.slice(totalPairs * groupSize));
    }

    setPairs(paired);
    setRemainder(remainder);
  };

  return (
    <div className={styles.pairingPage}>
      <h1 className={styles.pageTitle}>막뽑기 페이지</h1>
      <form onSubmit={handleFormSubmit} className={styles.form}>
        <label>
          이름(쉼표로 구분):
          <input
            type="text"
            value={namesInput}
            onChange={handleNamesInputChange}
            className={styles.inputField}
          />
        </label>
        <br />
        <label>
          팀 크기:
          <input
            type="number"
            value={groupSizeInput}
            onChange={handleGroupSizeInputChange}
            className={styles.inputField}
          />
        </label>
        <br />
        <button type="submit" className={styles.submitButton}>팀 짓기 시작</button>
      </form>

      <div className={styles.pairSection}>
        <h2 className={styles.sectionTitle}>팀</h2>
        {pairs.map((pair, index) => (
          <div key={index} className={styles.pairContainer}>
            <p className={styles.pairText}>팀 {index + 1}: {pair.join(', ')}</p>
          </div>
        ))}
      </div>

      {/* 남는 인원 출력 */}
      {remainder.length > 0 && (
        <div className={styles.pairSection}>
          <h2 className={styles.sectionTitle}>남는 인원</h2>
          <p className={styles.remainderText}>{remainder.join(', ')}</p>
        </div>
      )}
    </div>
  );
}
