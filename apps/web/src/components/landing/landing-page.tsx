import { SkipLink } from "@/components/layout/skip-link";
import { BlackBox } from "./black-box";
import { DecisionInspector } from "./decision-inspector";
import { Hero } from "./hero";
import base from "./landing.module.css";
import { SiteNav } from "./site-nav";
import { Traces } from "./traces";

export function LandingPage() {
  return (
    <div className={base.root}>
      <SkipLink />
      <SiteNav />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <Traces />
        <BlackBox />
        <DecisionInspector />
      </main>
    </div>
  );
}
