const express = require("express");
const fetch = require("node-fetch");
const app = express();
const PORT = process.env.PORT || 3000;

const burner = "EH1UKhLL9MTny9sCCGGrzVrbBAVAL6V3XsBXZvQ4wfe8";
const blu = "EWJZQLXkTfEzXxC3LgzZgTJiH6pY82xtLYnc3i5U2ZRV";
const rpc = "https://solana-api.projectserum.com";

app.use(express.json());
app.use(express.static("public"));

app.post("/verify", async (req, res) => {
  const { wallet } = req.body;
  if (!wallet || wallet.length < 32) return res.json({ ok: false });

  try {
    const sigsRes = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [burner, { limit: 20 }],
      }),
    });

    const sigsData = await sigsRes.json();
    const signatures = sigsData?.result?.map((s) => s.signature) || [];

    for (const sig of signatures) {
      const txRes = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getParsedTransaction",
          params: [sig, "json"],
        }),
      });

      const txData = await txRes.json();
      const tx = txData?.result;
      const blockTime = tx?.blockTime || 0;
      const now = Math.floor(Date.now() / 1000);
      const ix = tx?.transaction?.message?.instructions || [];
      const inner = tx?.meta?.innerInstructions || [];

      for (const section of inner) {
        if (section.instructions) ix.push(...section.instructions);
      }

      for (const instr of ix) {
        if (
          instr?.parsed?.type === "transfer" &&
          instr?.program === "spl-token" &&
          instr?.parsed?.info?.source === wallet &&
          instr?.parsed?.info?.destination === burner &&
          instr?.parsed?.info?.mint === blu &&
          Number(instr?.parsed?.info?.amount) >= 2000000 &&
          now - blockTime <= 300
        ) {
          return res.json({ ok: true });
        }
      }
    }

    return res.json({ ok: false });
  } catch (err) {
    console.error("Verification error:", err);
    return res.json({ ok: false });
  }
});

app.listen(PORT, () => console.log("Serum RPC verifier running on", PORT));