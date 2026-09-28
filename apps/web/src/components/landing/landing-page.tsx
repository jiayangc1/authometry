import { SkipLink } from "@/components/layout/skip-link";
import { Agents } from "./agents";
import { BlackBox } from "./black-box";
import { CodeSamples } from "./code-samples";
import { DecisionInspector } from "./decision-inspector";
import { EventStream } from "./event-stream";
import { FinalCta } from "./final-cta";
import { FlowExplorer } from "./flow-explorer";
import { GitConfig } from "./git-config";
import { Hero } from "./hero";
import base from "./landing.module.css";
import { OpenSource } from "./open-source";
import { Philosophy } from "./philosophy";
import { Protocols } from "./protocols";
import { Security } from "./security";
import { SiteFooter } from "./site-footer";
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
        <OpenSource />
        <Agents />
        <EventStream />
        <Security />
        <Philosophy />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
