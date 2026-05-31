import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

// Load-bearing cross-peer assertion for the advertised core action:
// "Anonymous 'never have I ever' party game — group sees % guilty per prompt".
// Peer A votes "I have" (guilty) and peer B votes "never" (innocent) on the
// SAME prompt. The tally must converge so EACH peer — including the opposite
// peer from the one that cast a given vote — reads the same aggregate
// "50% guilty · 2 voted" on that prompt card.
test("guilty tally aggregates across peers → both see 50% guilty · 2 voted", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    const cardA = a.locator(".nhi-card").first();
    const cardB = b.locator(".nhi-card").first();

    // Both peers must share the seed prompts before anyone votes.
    await expect(cardA.locator(".nhi-prompt")).toBeVisible();
    await expect(cardB.locator(".nhi-prompt")).toBeVisible();
    const promptText = (await cardA.locator(".nhi-prompt").innerText()).trim();
    expect((await cardB.locator(".nhi-prompt").innerText()).trim()).toBe(promptText);

    // Before any vote, the meter reads "no votes yet" on both peers.
    await expect(cardA.locator(".nhi-meter-label")).toHaveText("no votes yet");
    await expect(cardB.locator(".nhi-meter-label")).toHaveText("no votes yet");

    // Peer A admits guilt on the first prompt.
    await cardA.getByRole("button", { name: "I have", exact: true }).click();

    // The opposite peer (B) must see A's guilty vote land: 100% guilty · 1 voted.
    await expect(cardB.locator(".nhi-meter-label")).toHaveText("100% guilty · 1 voted");

    // Peer B votes "never" on the SAME prompt.
    await cardB.getByRole("button", { name: "never", exact: true }).click();

    // The aggregate must converge on BOTH peers: 1 of 2 guilty = 50%.
    await expect(cardA.locator(".nhi-meter-label")).toHaveText("50% guilty · 2 voted");
    await expect(cardB.locator(".nhi-meter-label")).toHaveText("50% guilty · 2 voted");
  } finally {
    await cleanup();
  }
});

// A prompt added on one peer must appear on the other (the custom-prompt path
// of the advertised game), and votes on that newly-shared prompt must tally.
test("a prompt added by peer A is votable on peer B and tallies back", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    const customPrompt = "Never have I ever crossed the mesh " + Date.now();
    await a.getByPlaceholder("add a prompt…").fill(customPrompt);
    await a.getByRole("button", { name: "add", exact: true }).click();

    // Peer B sees the new prompt.
    const cardB = b.locator(".nhi-card", { hasText: customPrompt });
    await expect(cardB.locator(".nhi-prompt")).toHaveText(customPrompt);

    // Peer B votes "I have" on it; peer A sees the tally on the same card.
    await cardB.getByRole("button", { name: "I have", exact: true }).click();
    const cardA = a.locator(".nhi-card", { hasText: customPrompt });
    await expect(cardA.locator(".nhi-meter-label")).toHaveText("100% guilty · 1 voted");
  } finally {
    await cleanup();
  }
});
