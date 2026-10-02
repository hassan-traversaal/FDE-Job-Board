import Image from "next/image";
import { ReviewControls } from "./ReviewControls";
import type { Review } from "./reviews";

// Reviewer photos come straight from Maven's hosts; skipping the optimizer
// keeps them working on any deploy target (Vercel or Workers).
function Avatar({ r, size }: { r: Review; size: number }) {
  return r.photo ? (
    <Image className="avatar" src={r.photo} alt="" width={size} height={size} unoptimized />
  ) : (
    <span className="avatar avatar--initial" aria-hidden="true">
      {r.name.charAt(0)}
    </span>
  );
}

function Card({ r }: { r: Review }) {
  return (
    <li className="rcard">
      <div className="rcard__head">
        <Avatar r={r} size={52} />
        <p className="rcard__who">
          <b>{r.name}</b>
          <span>{r.title}</span>
        </p>
      </div>
      <blockquote className="rcard__quote">
        <p>{r.text}</p>
      </blockquote>
      <p className="rcard__foot">
        <span>Maven review</span>
        <span>{r.date}</span>
      </p>
    </li>
  );
}

function Row({ items, slow = false }: { items: Review[]; slow?: boolean }) {
  return (
    <div className={`rrow${slow ? " rrow--slow" : ""}`}>
      <ul className="rrow__track">
        {items.map((r) => (
          <Card key={r.name + r.date} r={r} />
        ))}
      </ul>
      <ul className="rrow__track" aria-hidden="true">
        {items.map((r) => (
          <Card key={r.name + r.date} r={r} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Two rows of review cards drifting left to right, rendered on the server. The rows
 * carry only reviewers with photos, so every card that scrolls past has a face; the
 * full list below holds all of them. ReviewControls owns only the paused/open state
 * (WCAG 2.2.2 pause control).
 */
export function ReviewWall({ items }: { items: Review[] }) {
  const withPhotos = items.filter((r) => r.photo);
  const moving = withPhotos.length >= 8 ? withPhotos : items;
  return (
    <ReviewControls
      count={items.length}
      rows={
        <div className="rrows">
          <Row items={moving.filter((_, i) => i % 2 === 0)} />
          <Row items={moving.filter((_, i) => i % 2 === 1)} slow />
        </div>
      }
      list={
        <ul className="rlist wrap">
          {items.map((r) => (
            <li key={r.name + r.date} className="rlist__item">
              <div className="rcard__head">
                <Avatar r={r} size={44} />
                <p className="rcard__who">
                  <b>{r.name}</b>
                  <span>{r.title}</span>
                </p>
              </div>
              <blockquote>
                <p>{r.text}</p>
              </blockquote>
            </li>
          ))}
        </ul>
      }
    />
  );
}
