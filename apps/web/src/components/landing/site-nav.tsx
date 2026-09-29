"use client";

import { ArrowUpRight, Github, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { GITHUB_URL } from "./demo-data";
import base from "./landing.module.css";
import { MarkTile, cx } from "./primitives";
import styles from "./site-nav.module.css";

/** The four things visitors come for; root-relative so they work from /platform too. */
const links = [
  { label: "Product", href: "/#product" },
  { label: "Integrate", href: "/#integrate" },
  { label: "Security", href: "/platform#security" },
  { label: "Docs", href: "/docs" },
] as const;

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const wide = window.matchMedia("(min-width: 960px)");
    const onWide = () => wide.matches && setOpen(false);
    window.addEventListener("keydown", close);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", close);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <header className={styles.header} data-open={open} data-scrolled={scrolled}>
      <nav aria-label="Main" className={cx(base.container, styles.nav)}>
        <Link aria-label="Authometry home" className={styles.brand} href="/">
          <MarkTile size={26} />
          <span>Authometry</span>
        </Link>
        <ul className={styles.links}>
          {links.map((link) => (
            <li key={link.href}>
              {link.href.includes("#") ? (
                <a href={link.href}>{link.label}</a>
              ) : (
                <Link href={link.href}>{link.label}</Link>
              )}
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <a className={styles.github} href={GITHUB_URL} rel="noreferrer" target="_blank">
            <Github aria-hidden="true" />
            <span>GitHub</span>
            <span className={base.srOnly}>(opens in a new tab)</span>
          </a>
          <Link className={styles.signIn} href="/login">
            Sign in
          </Link>
          <Link className={cx(base.button, base.primary, styles.cta)} href="/docs/getting-started">
            Start building
          </Link>
          <button
            aria-controls={menuId}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className={styles.menuButton}
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </nav>
      <div className={styles.sheet} hidden={!open} id={menuId}>
        <ul className={base.container}>
          {links.map((link) => (
            <li key={link.href}>
              {link.href.includes("#") ? (
                <a href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </a>
              ) : (
                <Link href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              )}
            </li>
          ))}
          <li>
            <a href={GITHUB_URL} rel="noreferrer" target="_blank">
              GitHub <ArrowUpRight aria-hidden="true" />
              <span className={base.srOnly}>(opens in a new tab)</span>
            </a>
          </li>
          <li>
            <Link href="/login" onClick={() => setOpen(false)}>
              Sign in to the console
            </Link>
          </li>
          <li className={styles.sheetCta}>
            <Link className={cx(base.button, base.primary)} href="/docs/getting-started">
              Start building
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
