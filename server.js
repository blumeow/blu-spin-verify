
const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

const burner = "EH1UKhLL9MTny9sCCGGrzVrbBAVAL6V3XsBXZvQ4wfe8";
const blu = "EWJZQLXkTfEzXxC3LgzZgTJiH6pY82xtLYnc3i5U2ZRV";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

app.use(express.json());
app.use(express.static('public'));

app.post('/verify', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet || wallet.length < 32) return res.json({ ok: false });

  try {
    let sigsRes;
    try {
      sigsRes = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignaturesForAddress",
          params: [burner, { limit: 10 }]
        })
      });
    } catch (e) {
      console.error('Fetch signatures failed:', e);
      return res.json({ ok: false, error: 'fetch_failed' });
    }

    const sigsJson = await sigsRes.json();
    const signatures = sigsJson.result;
    const now = Math.floor(Date.now() / 1000);

    for (const sig of signatures) {
      let txRes;
      try {
        txRes = await fetch(SOLANA_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getParsedTransaction",
            params: [sig.signature, "json"]
          })
        });
      } catch (e) {
        console.error('Fetch tx failed:', e);
        continue;
      }

      const txData = await txRes.json();
      const blockTime = txData?.result?.blockTime || 0;
      const instructions = txData?.result?.transaction?.message?.instructions || [];
      const innerInstructions = txData?.result?.meta?.innerInstructions || [];
      for (const inner of innerInstructions) {
        if (inner.instructions) instructions.push(...inner.instructions);
      }

      for (const instr of instructions) {
        if (
          instr.program === "spl-token" &&
          instr.parsed?.type === "transfer" &&
          instr.parsed.info?.destination === burner &&
          instr.parsed.info?.source === wallet &&
          instr.parsed.info?.mint === blu &&
          Number(instr.parsed.info?.amount) >= 2000000000000
        ) {
          if (now - blockTime <= 300) {
            return res.json({ ok: true });
          }
        }
      }
    }

    return res.json({ ok: false });
  } catch (e) {
    console.error("RPC proxy error:", e.message);
    return res.json({ ok: false });
  }
});

app.listen(PORT, () => console.log("RPC verifier running on port", PORT));
