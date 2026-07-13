# EdgeLine OS — Demo Video Script (5 minutes)

## Before You Start Recording

1. Start the server: `node server.mjs`
2. Open the browser at `https://edgeline-os.onrender.com` (use the live Render URL)
3. Open Telegram on your phone — have the EdgeLine OS bot chat visible
4. Have the terminal visible (shows TxLINE heartbeats and fixture logs)
5. Use Loom or OBS to record your screen + voice

---

## INTRO (0:00 – 0:30)

**Show:** Browser opening the EdgeLine OS landing page

**Say:**
> "Hi, I'm presenting EdgeLine OS — an autonomous AI sports trading platform powered entirely by the TxLINE oracle. The core idea is simple: instead of a human watching live World Cup odds and placing bets manually, four AI agents do it autonomously, 24 hours a day, with every result cryptographically verified on Solana mainnet."

**Show:** Scroll slowly down the landing page — hero section, feature cards, "How it works" steps

> "You can see here: the platform connects to TxLINE's live data stream, four independent agents analyse every fixture each tick, a risk engine controls position sizing, and at full time the result is proved on-chain before any payout is calculated."

---

## LOGIN AND DASHBOARD (0:30 – 1:00)

**Show:** Click "Launch trading platform" → scroll to the Create Account form

**Say:**
> "Users sign up with a Gmail account, name, country, and phone number. No verification code needed — straight into the platform."

**Show:** Fill in the form quickly (use a test account) → click Create my account → dashboard loads

> "The dashboard opens immediately. Notice the top bar — it says 'live · mainnet', the connection dot is green, and it's already receiving data from TxLINE."

---

## LIVE FIXTURES (1:00 – 1:45)

**Show:** Click "Live Matches" in the left sidebar

**Say:**
> "This is the fixture board. Every match here is coming directly from TxLINE's `/api/fixtures/snapshot` endpoint in real time."

**Show:** Point to the upcoming semi-finals

> "We can see France vs Spain and England vs Argentina — these are the real 2026 World Cup semi-finals scheduled for July 14th and 15th. The odds are calculated from our ELO model against the TxLINE market consensus."

**Show:** Point to the finished quarter-final results

> "And here are the completed quarter-finals — Argentina 3-1 Switzerland, Norway 1-2 England — all marked as Final. These results were confirmed by the TxLINE `GameState` field and enriched from the historical scores endpoint."

**Show:** Click the filter tabs — "Live", "Upcoming", "Finished" — to demonstrate the filtering

> "Users can filter by match status. When a semi-final kicks off on July 14th, it will automatically move to the Live tab and the agents will start trading it immediately."

---

## AI AGENTS RUNNING (1:45 – 2:45)

**Show:** Click "Trading" in the sidebar → click ▶ Run

**Say:**
> "Now let me start the agents. Watch what happens."

**Show:** Wait 3-5 seconds — the signal radar starts lighting up, decisions appear in the AI Reasoning panel

> "The signal radar is showing all four agents firing simultaneously. Each dot represents a signal — teal is Sharp Sentinel, gold is Model Voyager, indigo is Maker Prime, and red is Counterflow."

**Show:** Scroll down to the AI Reasoning panel — show the decision cards

> "Every decision the AI makes is logged here with full reasoning. Look at this — Model Voyager says: 'ELO model 52.1% vs market 47.9% — 4.2 point edge.' That's the AI finding a pricing discrepancy between our probability model and what TxLINE is showing as the market consensus."

**Show:** Point to the confidence bar, action tag, stake amount

> "82% confidence. BUY signal on France. $89 stake. This all happens autonomously — no human input required."

**Show:** Show the Live Agent Activity ticker at the top

> "And up here the live activity ticker shows the most recent agent actions in real time."

---

## TELEGRAM ALERTS (2:45 – 3:15)

**Show:** Switch to your phone camera OR screen-record the Telegram chat

**Say:**
> "Meanwhile, on Telegram — every strong signal fires an alert directly to my phone."

**Show:** The Telegram bot receiving a signal message

> "Here it is — Sharp Sentinel, BUY, France vs Spain, 78% confidence, $104 stake. With the EdgeLine OS bot, you don't need to have the dashboard open. The AI trades for you and sends you updates."

**Show:** Type `/matches` in the Telegram bot

> "I can also query the system directly from Telegram. Typing `/matches` shows me the live fixtures."

**Show:** Type `/portfolio`

> "And `/portfolio` shows my current equity, realized PnL, win rate — everything without touching the dashboard."

---

## ON-CHAIN SOLANA PROOF (3:15 – 4:15)

**Show:** Click "On-Chain" in the sidebar

**Say:**
> "This is the most technically impressive part of EdgeLine OS. Every time a match finishes, we don't just trust the score — we prove it."

**Show:** The proof panel — program ID, network: mainnet, Merkle root

> "When Argentina beat Switzerland 3-1 in extra time, our settlement engine detected the Final status from TxLINE's GameState field, called `validateFixture` on the TxLINE Solana program, and received a Merkle proof covering all 8 statistics — goals, cards, corners."

**Show:** Click the Solscan link if a proof exists, OR describe it

> "The proof receipt shows the Merkle root, the Solana signature, and a direct link to Solscan where anyone can verify the transaction on-chain. The program ID `9ExbZj...KaA` is TxLINE's mainnet oracle program. This means the result is cryptographically immutable — it cannot be altered or disputed."

**Show:** Click "Portfolio" → show the Settlement History

> "Back in the portfolio, the settlement history shows every completed trade with its Solana proof status. 'Verified on Solana ✅' means that position's payout was calculated only after on-chain verification."

---

## ANALYTICS (4:15 – 4:40)

**Show:** Click "Analytics" in the sidebar

**Say:**
> "The analytics screen gives us full performance intelligence. Strategy leaderboard ranked by PnL. Sharpe ratio. Signal accuracy calibration — this measures how honest each agent is, comparing their stated confidence to their actual win rate."

**Show:** Scroll through the tabs — leaderboard, EV chart, equity curve, heatmap

> "The equity curve shows portfolio value over time. The EV chart shows expected value distribution across recent signals — bars above zero mean positive edge. The win-rate heatmap breaks down each agent's performance by competition stage."

---

## CLOSE (4:40 – 5:00)

**Show:** Return to the landing page hero section

**Say:**
> "EdgeLine OS demonstrates what's possible when you combine a production-grade AI agent framework with the TxLINE oracle's deterministic, cryptographically-anchored data. The agents are fully autonomous, the settlement is trustless, and the on-chain proofs make every result verifiable by anyone."

> "The platform is live at edgeline-os.onrender.com. The code is open source on GitHub. Thank you."

---

## Tips for Recording

1. **Speak slowly and clearly** — judges watch many demos, clear narration stands out
2. **Highlight the TxLINE connection** — mention "from TxLINE" every time you show live data
3. **Show the terminal briefly** — `[Telegram] Bot polling started ✅` and `[EdgeLine] TxLINE stream connected ✅` prove it's real
4. **Show Telegram on a real phone** — picking up your phone on camera is more convincing than a simulator
5. **Don't skip the Solscan link** — clicking through to the actual Solana transaction is the most powerful 10 seconds in the demo
6. **Total time target:** Keep it tight at 4:45-5:00. Judges appreciate brevity.
