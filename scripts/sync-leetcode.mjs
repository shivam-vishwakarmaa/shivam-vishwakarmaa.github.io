// Downloads your public LeetCode submission calendar and saves it to src/leetcode-data.json.
//   npm run sync          strict: exits with an error if LeetCode can't be reached
//   --soft                used automatically before `npm run dev` and `npm run build`: if LeetCode can't be
//                         reached, keep the data we already have and let the build carry on
// The username comes from site.config.js (leetcode.username).

import fs from "node:fs";
import site from "../site.config.js";

const soft = process.argv.includes("--soft");

async function main() {
  const fail = (message) => {
    console.error(message);
    process.exitCode = soft ? 0 : 1;
  };

  const username = site.leetcode?.username;
  if (!username) return fail("Set leetcode.username in site.config.js first.");

  const query = `query($u: String!) {
    matchedUser(username: $u) {
      userCalendar { activeYears streak totalActiveDays submissionCalendar }
    }
  }`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let cal;
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
      body: JSON.stringify({ query, variables: { u: username } }),
      signal: controller.signal,
    });
    if (!res.ok) return fail(`LeetCode answered with HTTP ${res.status}. Your old data file was kept.`);
    cal = (await res.json())?.data?.matchedUser?.userCalendar;
  } catch (err) {
    return fail(`Could not reach LeetCode (${err.message}). Your old data file was kept.`);
  } finally {
    clearTimeout(timer);
  }
  if (!cal) return fail(`LeetCode has no public calendar for "${username}". Your old data file was kept.`);

  // { "<unix day start>": count } -> { "YYYY-MM-DD": count }
  const days = {};
  for (const [stamp, count] of Object.entries(JSON.parse(cal.submissionCalendar))) {
    days[new Date(Number(stamp) * 1000).toISOString().slice(0, 10)] = count;
  }

  const out = {
    username,
    fetchedAt: new Date().toISOString(),
    streak: cal.streak,
    totalActiveDays: cal.totalActiveDays,
    days,
  };
  fs.writeFileSync(new URL("../src/leetcode-data.json", import.meta.url), JSON.stringify(out));
  const total = Object.values(days).reduce((a, b) => a + b, 0);
  console.log(`LeetCode graph updated: ${Object.keys(days).length} active days, ${total} submissions (streak ${cal.streak}).`);
}

await main();
