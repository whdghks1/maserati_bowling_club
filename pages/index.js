// pages/index.js
import Link from "next/link";

const IS_ADMIN = process.env.NEXT_PUBLIC_IS_ADMIN === "true";

const tiles = [
  { href: "/team", title: "팀 배정" },
  { href: "/mack", title: "막뽑기" },
  { href: "/record", title: "기록" },
  { href: "/monthly", title: "월간보고서" },
  { href: "/bungs", title: "벙 관리", admin: true },
  { href: "/bung-stats", title: "벙 통계", admin: true },
  { href: "/members-admin", title: "멤버 관리", admin: true },
];

function Tile({ href, title }) {
  return (
    <Link href={href} legacyBehavior>
      <a className="tile">
        <span className="title">{title}</span>
        <span className="arrow">→</span>
      </a>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="wrap">
      <header className="head">
        <h1 className="h1">Maserati Bowling Club</h1>
        <p className="sub">볼링 기록 관리</p>
      </header>

      <section className="grid">
        {tiles
          .filter((t) => !t.admin || IS_ADMIN) // ✅ 관리자 메뉴 숨김
          .map((t) => (
            <Tile key={t.href} {...t} />
          ))}
      </section>

      <style jsx>{`
        .wrap {
          max-width: 980px;
          margin: 0 auto;
          padding: 16px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto;
          color: #111;
        }

        .head {
          margin-bottom: 14px;
        }
        .h1 {
          margin: 0 0 4px 0;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.02em;
        }
        .sub {
          margin: 0;
          font-size: 13px;
          color: #666;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 720px) {
          .grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 980px) {
          .grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        /* ✅ 버튼 스타일 */
        .tile {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border: 2px solid #e6e6e6;   /* ✅ 확실한 보더 */
          border-radius: 14px;
          background: white;
          text-decoration: none;       /* ✅ 링크 느낌 제거 */
          color: #111;                 /* ✅ 무조건 검정 */
          cursor: pointer;
          transition: background 0.08s ease, border-color 0.08s ease;
        }
        .tile:hover {
          background: #fafafa;
          border-color: #cfcfcf;
        }
        .tile:active {
          background: #f2f2f2;
        }

        .title {
          font-size: 15px;
          font-weight: 900;
        }
        .arrow {
          font-size: 16px;
          color: #999;
        }

        .tile:visited { color: #111; }
        .tile:hover, .tile:active { color: #111; }

        @media (max-width: 480px) {
          .wrap {
            padding: 12px;
          }
          .tile {
            padding: 12px 14px;
            border-radius: 12px;
          }
        }
      `}</style>
    </div>
  );
}
