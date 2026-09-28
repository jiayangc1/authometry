import { SkipLink } from "@/components/layout/skip-link";
import { BlackBox } from "./black-box";
import { CodeSamples } from "./code-samples";
import { DecisionInspector } from "./decision-inspector";
import { FlowExplorer } from "./flow-explorer";
import { GitConfig } from "./git-config";
import { Hero } from "./hero";
import base from "./landing.module.css";
import { Protocols } from "./protocols";
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
        <FlowExplorer />
        <GitConfig />
        <Protocols />
        <CodeSamples />
      </main>
    </div>
  );
}
