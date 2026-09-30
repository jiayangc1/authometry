import { SkipLink } from "@/components/layout/skip-link";
import { BlackBox } from "./black-box";
import { CodeSamples } from "./code-samples";
import { DecisionInspector } from "./decision-inspector";
import { FinalCta } from "./final-cta";
import { GoDeeper } from "./go-deeper";
import { Hero } from "./hero";
import base from "./landing.module.css";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";
import { Traces } from "./traces";

/**
 * Three chapters: see the decision, understand the denial, integrate it.
 * Reference material (protocol detail, config, agents, events, security) lives on /platform.
 */
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
        <CodeSamples />
        <GoDeeper />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
