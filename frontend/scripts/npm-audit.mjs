// Fails on any high or critical npm advisory except the ones accepted below.
//
// `npm audit` cannot ignore a single advisory, so an unfixable one in a dev-only
// tool would otherwise block every PR. Each acceptance carries a review date; once
// it passes, the advisory fails the audit again until someone re-checks for a fix.
import { spawnSync } from "node:child_process";

const ACCEPTED = {
    // braces <=3.0.3: stack-exhaustion DoS from deeply nested glob patterns. No
    // patched release exists — 3.0.3 is the latest. Reached only at lint time via
    // eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch,
    // whose patterns come from our own config, and never shipped to the browser.
    "GHSA-vfj7-8cjw-p6xm": { reviewBy: "2027-01-06" },
};
const FAILING_SEVERITIES = new Set(["high", "critical"]);

const audit = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });
if (!audit.stdout) {
    console.error(audit.stderr);
    process.exit(2);
}
const report = JSON.parse(audit.stdout);
if (report.error) {
    console.error(report.error.summary ?? report.error);
    process.exit(2);
}

// Advisory objects sit in the `via` list of the package they affect; packages that
// are only vulnerable through a dependency list that dependency's name instead.
const advisories = new Map();
for (const [pkg, vuln] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of vuln.via) {
        if (typeof via === "string" || !FAILING_SEVERITIES.has(via.severity)) continue;
        const id = via.url.split("/").pop();
        advisories.set(id, { ...via, pkg });
    }
}

const today = new Date().toISOString().slice(0, 10);
let failed = false;
for (const [id, adv] of advisories) {
    const accepted = ACCEPTED[id];
    if (accepted && today <= accepted.reviewBy) {
        console.log(`accepted  ${adv.severity.padEnd(8)} ${adv.pkg}: ${adv.title} (${id}, review by ${accepted.reviewBy})`);
        continue;
    }
    const why = accepted ? ` — acceptance expired ${accepted.reviewBy}, re-check for a fix` : "";
    console.log(`FAIL      ${adv.severity.padEnd(8)} ${adv.pkg}: ${adv.title} (${adv.url})${why}`);
    failed = true;
}
for (const id of Object.keys(ACCEPTED)) {
    if (!advisories.has(id)) console.log(`note      ${id} no longer reported; remove its acceptance`);
}

if (failed) {
    console.log("\nRun `npm audit` for fix suggestions.");
    process.exit(1);
}
console.log(`\nNo unaccepted high or critical advisories (${advisories.size} checked).`);
