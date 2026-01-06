// pages/MainPage.js

import Link from "next/link";
import Image from 'next/image';
import styles from "../src/main.module.css"; // CSS 모듈 import

export default function MainPage() {
  return (
    <div className={styles.mainPage}>
      <div className={styles.contentWrapper}>
        <div className={styles.centerContent}>
          {/* 이미지 추가 */}
          <div className={styles.imageWrapper}>
            <Image src="/image/logo.jpeg" alt="Logo" width={200} height={200} />
          </div>
          {/* 버튼 */}
          <div className={styles.buttonWrapper}>
            <Link href="/team">
              <div className={styles.button}>팀 배정</div>
            </Link>
            <Link href="/mack">
              <div className={styles.button}>막뽑기</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}