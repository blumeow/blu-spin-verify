const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

const burner = "EH1UKhLL9MTny9sCCGGrzVrbBAVAL6V3XsBXZvQ4wfe8";
const blu = "EWJZQLXkTfEzXxC3LgzZgTJiH6pY82xtLYnc3i5U2ZRV";

app.use(express.json());
app.use(express.static('public'));

app.post('/verify', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet || wallet.length < 32) return res.json({ ok: false });

  try {
    const url = `https://public-api.solscan.io/account/transaction?address=${wallet}&limit=20`;
    const txsRes = await fetch(url, {
      headers: { accept: "application/json" }
    });

    let txs;
    try {
      txs = await txsRes.json();
    } catch (jsonErr) {
      console.error("Failed to parse Solscan JSON:", jsonErr);
      return res.json({ ok: false, error: "invalid_json" });
    }

    const now = Math.floor(Date.now() / 1000);
    for (const tx of txs || []) {
      const blockTime = tx.blockTime || 0;
      const tokenTransfers = tx.tokenBalanes || tx.tokenTransfers || [];

      for (const transfer of tokenTransfers) {
        if (
          transfer.src === wallet &&
          transfer.dst === burner &&
          transfer.tokenAddress === blu &&
          Number(transfer.amount) >= 2000000 &&
          now - blockTime <= 300
        ) {
          return res.json({ ok: true });
        }
      }
    }

    return res.json({ ok: false });
  } catch (err) {
    console.error("Solscan verify error:", err);
    return res.json({ ok: false });
  }
});

app.listen(PORT, () => console.log("Solscan verifier running on port", PORT));