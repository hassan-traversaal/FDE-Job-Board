import Image from "next/image";
import Link from "next/link";
import { links, trained } from "./content";
import { NavLinks } from "./NavLinks";

export const ext = { target: "_blank", rel: "noreferrer" } as const;

/** Pages the course app serves through next.config.ts rewrites. They are not Next routes,
 *  so links to them are plain anchors (a full page load), never client-side navigation. */
export const isCoursePath = (href: string) => /^\/(signin|library|session)(\/|\?|$)/.test(href);

export function Arrow({ external = false }: { external?: boolean }) {
  return (
    <svg className="arrow" viewBox="0 0 16 16" aria-hidden="true">
      {external ? <path d="M5 11 11 5M6 5h5v5" /> : <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />}
    </svg>
  );
}

export function Btn({
  href,
  children,
  tone = "coral",
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  tone?: "coral" | "ink" | "paper";
  external?: boolean;
}) {
  const cls = `btn btn--${tone}`;
  const inner = (
    <>
      <span>{children}</span>
      <Arrow external={external} />
    </>
  );
  if (external || href.startsWith("#") || isCoursePath(href)) {
    return (
      <a className={cls} href={href} {...(external ? ext : {})}>
        {inner}
      </a>
    );
  }
  return (
    <Link className={cls} href={href}>
      {inner}
    </Link>
  );
}

/** Logo strip of teams Traversaal has trained, in brand colour, sized by logo shape. */
export function TrainedLogos({ className = "", eager = false }: { className?: string; eager?: boolean }) {
  return (
    <ul className={`logos ${className}`}>
      {trained.map((t) => (
        <li key={t.name} data-shape={t.shape}>
          <Image src={t.src} alt={t.name} width={t.w} height={t.h} sizes="140px" loading={eager ? "eager" : "lazy"} />
        </li>
      ))}
    </ul>
  );
}

export function Nav() {
  return (
    <header className="nav">
      <div className="nav__in">
        <Link href="/" className="nav__brand" aria-label="Traversaal FDE home">
          <Image src="/site/traversaal-logo.png" alt="Traversaal.ai" width={1592} height={400} sizes="150px" preload />
        </Link>
        <NavLinks />
        <a className="nav__cta" href={links.freeCourse}>
          Start free
          <Arrow />
        </a>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot__in">
        <Link href="/" className="foot__brand" aria-label="Traversaal FDE home">
          <Image src="/site/traversaal-logo.png" alt="Traversaal.ai" width={1592} height={400} sizes="140px" />
        </Link>
        <ul className="foot__links">
          <li>
            <Link href={links.teams}>Team training</Link>
          </li>
          <li>
            <Link href={links.contact}>Work with us</Link>
          </li>
          <li>
            <Link href={links.jobs}>FDE job board</Link>
          </li>
          <li>
            <a href={links.academy}>Traversaal Academy</a>
          </li>
          <li>
            <a href={links.labs}>Traversaal Labs</a>
          </li>
        </ul>
        <p className="foot__legal">© 2026 Traversaal AI, Inc.</p>
      </div>
    </footer>
  );
}
