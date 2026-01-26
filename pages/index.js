// pages/index.js
import { useRouter } from "next/router";

const IS_ADMIN = process.env.NEXT_PUBLIC_IS_ADMIN === "true";

const tiles = [
  { href: "/team", title: "팀 배정" },
  { href: "/mack", title: "막뽑기" },
  { href: "/record", title: "기록" },
  { href: "/monthly", title: "월간보고서" },

  // 관리자용(기본 숨김)
  { href: "/bungs", title: "벙 관리", admin: true },
  { href: "/bung-stats", title: "벙 통계", admin: true },
  { href: "/members-admin", title: "멤버 관리", admin: true },
];

function TileButton({ href, title }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="tile"
      onClick={() => router.push(href)}
      aria-label={title}
    >
      <span className="title">{title}</span>
      <span className="arrow" aria-hidden="true">→</span>
    </button>
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
          .filter((t) => !t.admin || IS_ADMIN)
          .map((t) => (
            <TileButton key={t.href} href={t.href} title={t.title} />
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

        .head { margin-bottom: 14px; }
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
          .grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 980px) {
          .grid { grid-template-columns: repeat(3, 1fr); }
        }

        /* ✅ "진짜 버튼" */
       .tile {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 16px 18px;
          border-radius: 12px;
          border: 1px solid #dcdcdc;

          background: #f9f9f9;
          color: #111;
          text-align: left;
          cursor: pointer;

          box-shadow:
            0 1px 2px rgba(0,0,0,0.04);

          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            transform 0.08s ease;
        }

        /* hover */
        .tile:hover {
          background: #ffffff;
          border-color: #c9c9c9;
          box-shadow:
            0 4px 10px rgba(0,0,0,0.06);
          transform: translateY(-1px);
        }

        /* active */
        .tile:active {
          background: #f2f2f2;
          transform: translateY(0);
          box-shadow:
            0 2px 4px rgba(0,0,0,0.04);
        }

        /* focus */
        .tile:focus-visible {
          outline: none;
          border-color: #111;
        }

        /* 제목 */
        .title {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        /* 화살표 */
        .arrow {
          font-size: 17px;
          color: #888;
          transition: transform 0.15s ease, color 0.15s ease;
        }

        .tile:hover .arrow {
          color: #444;
          transform: translateX(3px);
        }


        @media (max-width: 480px) {
          .wrap { padding: 12px; }
          .tile {
            padding: 14px 16px;
            border-radius: 12px;
          }
          .title {
            font-size: 15px;
          }
        }
      `}</style>
    </div>
  );
}
