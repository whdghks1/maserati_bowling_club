import React, { useState } from 'react';
import styles from '../src/mack.module.css';

export default function PairingPage() {
  const [namesInput, setNamesInput] = useState('');
  const [groupSizeInput, setGroupSizeInput] = useState('');
  const [pairs, setPairs] = useState([]);
  const [remainder, setRemainder] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleNamesInputChange = (event) => {
    setNamesInput(event.target.value);
  };

  const handleGroupSizeInputChange = (event) => {
    setGroupSizeInput(event.target.value);
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    setLoading(true);

    const names = namesInput.split(',').map(name => name.trim());
    const groupSize = parseInt(groupSizeInput);

    if (names.length === 0 || isNaN(groupSize) || groupSize <= 0) {
      console.error('올바른 이름과 숫자를 입력해주세요.');
      setLoading(false);
      return;
    }

    setTimeout(() => {
      let counter = 0;
      const interval = setInterval(() => {
        counter++;

        const newShuffledNames = names.slice().sort(() => Math.random() - 0.5);
        const newPaired = [];
        const newRemainder = [];
        const newTotalPairs = Math.floor(newShuffledNames.length / groupSize);

        for (let i = 0; i < newTotalPairs * groupSize; i += groupSize) {
          newPaired.push(newShuffledNames.slice(i, i + groupSize));
        }

        if (newShuffledNames.length % groupSize !== 0) {
          newRemainder.push(...newShuffledNames.slice(newTotalPairs * groupSize));
        }

        setPairs(newPaired);
        setRemainder(newRemainder);

        if (counter === 10) { // 적당한 반복 횟수
          clearInterval(interval);
          setLoading(false);
        }
      }, 200 + counter * 40); // 간격을 더 천천히 늘림
    }, 0);
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

      <div className={`${styles.pairSection}`}>
        <div className={styles.pairSection}>
          <div className={`team section ${loading ? styles.blurred : ''}`}>
            {loading && (
              <div className={`${styles.team} ${styles.loadingIndicator}`}>
                <div className={`${styles.loader} ${styles.notBlurred}`}></div>
              </div>
            )}

            {pairs.length > 0 && (
              <div>
                <h2 className={`${styles.sectionTitle} ${loading ? styles.blurred : ''}`}>팀</h2>
                {pairs.map((pair, index) => (
                  <div key={index} className={styles.pairContainer}>
                    <p className={styles.pairText}>팀 {index + 1}: {pair.join(', ')}</p>
                  </div>
                ))}
              </div>
            )}
            {remainder.length > 0 && (
              <div>
                <div className={styles.pairSection}>
                  <h2 className={styles.sectionTitle}>남는 인원</h2>
                  <p className={styles.remainderText}>{remainder.join(', ')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
