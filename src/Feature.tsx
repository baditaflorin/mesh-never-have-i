import { useEffect, useMemo, useState } from "react";
import type { MeshConfig, YRoom } from "@baditaflorin/mesh-common";
import * as Y from "yjs";

type Props = { room: YRoom | null; config: MeshConfig };

type Prompt = { id: string; text: string; ts: number };
type VotesByPrompt = Record<string, Record<string, boolean>>;

const SEED_PROMPTS = [
  "Never have I ever been on TV",
  "Never have I ever sung karaoke in public",
  "Never have I ever taken a taxi I couldn't afford",
  "Never have I ever sent a text to the wrong person",
  "Never have I ever lied about my age",
  "Never have I ever pretended to like a gift",
  "Never have I ever fallen asleep at work",
  "Never have I ever ghosted someone",
];

export function Feature({ room, config }: Props) {
  void config;
  const [, rerender] = useState(0);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!room) return;
    const prompts = room.doc.getArray<Prompt>("prompts");
    const votes = room.doc.getMap<Y.Map<boolean>>("votes");
    if (prompts.length === 0) {
      prompts.push(SEED_PROMPTS.map((text, i) => ({ id: `seed-${i}`, text, ts: 0 })));
    }
    const onChange = () => rerender((n) => n + 1);
    prompts.observe(onChange);
    votes.observeDeep(onChange);
    return () => {
      prompts.unobserve(onChange);
      votes.unobserveDeep(onChange);
    };
  }, [room]);

  const data = useMemo<{ prompts: Prompt[]; votes: VotesByPrompt }>(() => {
    if (!room) return { prompts: [], votes: {} };
    const prompts = room.doc.getArray<Prompt>("prompts").toArray();
    const votesYMap = room.doc.getMap<Y.Map<boolean>>("votes");
    const votes: VotesByPrompt = {};
    votesYMap.forEach((row, pid) => {
      const obj: Record<string, boolean> = {};
      row.forEach((v, peer) => {
        obj[peer] = v;
      });
      votes[pid] = obj;
    });
    return { prompts, votes };
  }, [room]);

  if (!room) {
    return (
      <div className="nhi-screen">
        <h1>never have I ever</h1>
        <p className="nhi-status">Connecting…</p>
      </div>
    );
  }

  const present = room.peerCount + 1;

  const vote = (promptId: string, guilty: boolean) => {
    const votesYMap = room.doc.getMap<Y.Map<boolean>>("votes");
    let row = votesYMap.get(promptId);
    if (!row) {
      row = new Y.Map<boolean>();
      votesYMap.set(promptId, row);
    }
    row.set(room.peerId, guilty);
  };

  const addPrompt = () => {
    const text = draft.trim();
    if (!text) return;
    const prompts = room.doc.getArray<Prompt>("prompts");
    prompts.push([{ id: crypto.randomUUID(), text, ts: Date.now() }]);
    setDraft("");
  };

  const removePrompt = (id: string) => {
    const prompts = room.doc.getArray<Prompt>("prompts");
    const idx = prompts.toArray().findIndex((p) => p.id === id);
    if (idx >= 0) prompts.delete(idx, 1);
  };

  return (
    <div className="nhi-screen">
      <header className="nhi-header">
        <h1>never have I ever</h1>
        <p className="nhi-status">
          {present} player{present === 1 ? "" : "s"} · votes stay anonymous
        </p>
      </header>

      <ul className="nhi-list">
        {data.prompts.map((p) => {
          const row = data.votes[p.id] ?? {};
          const myVote = row[room.peerId];
          const total = Object.values(row).length;
          const guilty = Object.values(row).filter(Boolean).length;
          const pct = total > 0 ? Math.round((guilty / total) * 100) : 0;
          return (
            <li key={p.id} className="nhi-card">
              <p className="nhi-prompt">{p.text}</p>
              <div className="nhi-buttons">
                <button
                  type="button"
                  className={`nhi-btn nhi-guilty ${myVote === true ? "is-active" : ""}`}
                  onClick={() => vote(p.id, true)}
                >
                  I have
                </button>
                <button
                  type="button"
                  className={`nhi-btn nhi-innocent ${myVote === false ? "is-active" : ""}`}
                  onClick={() => vote(p.id, false)}
                >
                  never
                </button>
              </div>
              <div className="nhi-meter">
                <div className="nhi-meter-fill" style={{ width: total > 0 ? `${pct}%` : "0%" }} />
                <span className="nhi-meter-label">
                  {total > 0 ? `${pct}% guilty · ${total} voted` : "no votes yet"}
                </span>
              </div>
              {p.ts > 0 && (
                <button type="button" className="nhi-rm" onClick={() => removePrompt(p.id)}>
                  remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className="nhi-add"
        onSubmit={(e) => {
          e.preventDefault();
          addPrompt();
        }}
      >
        <input
          placeholder="add a prompt…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={100}
        />
        <button type="submit">add</button>
      </form>
    </div>
  );
}
