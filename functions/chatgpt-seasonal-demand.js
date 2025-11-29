import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function askGemini(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  return await result.response.text();
}

// New helper: try to parse percentage range from text, return e.g. "10-25%"
function parsePercentageRange(text) {
  if (!text) return null;
  const t = String(text);
  // common patterns: "increase by 10-25%", "increase 10% to 25%", "10%-25%", "increase of 15%"
  const reRange = /(\d{1,3})\s*(?:%|\spercent)?\s*(?:[\-to]{1,3})\s*(\d{1,3})\s*%?/i;
  const reSingle = /(?:increase|up|rise|boost|grow).{0,20}?(\d{1,3})\s*%/i;
  const m = t.match(reRange);
  if (m) {
    const min = Number(m[1]), max = Number(m[2]);
    if (min >= 0 && max >= min) return `${min}-${max}%`;
  }
  const m2 = t.match(reSingle);
  if (m2) {
    const v = Number(m2[1]);
    if (!isNaN(v)) return `${Math.max(1, v-5)}-${v+5}%`;
  }
  // fallback keyword mapping
  const lower = t.toLowerCase();
  if (/\b(high|strong|significant|substantial)\b/.test(lower)) return "20-50%";
  if (/\b(moderate|moderately|steady)\b/.test(lower)) return "10-20%";
  if (/\b(slight|small|minor|mild)\b/.test(lower)) return "5-10%";
  return null;
}

router.get("/api/chatgpt-seasonal-demand", async (req, res) => {
  const item = req.query.item;
  const type = req.query.type;

  if (type === "list") {
    let prompt = req.body?.prompt;
    if (!prompt) {
      prompt = `List 5 items that are in high demand in India right now and give a short reason for each. Format: name - reason. If possible include a short suggested increase percentage (e.g. 10-25%).`;
    }
    try {
      const answer = await askGemini(prompt);
      console.log("Gemini raw answer:", answer);
      const items = answer
        .split('\n')
        .map(line => line.replace(/^[\-\*\d\.]+\s*/, ''))
        .map(line => {
          const [name, ...reasonArr] = line.split('-');
          const reason = reasonArr.join('-').trim();
          const increaseRange = parsePercentageRange(reason || name);
          return { name: name?.trim(), reason, increaseRange };
        })
        .filter(i => i.name && i.reason);
      return res.json({ items });
    } catch (err) {
      return res.status(500).json({ error: "Gemini API error", details: err.message });
    }
  }

  if (!item) return res.status(400).json({ error: "Missing item" });

  let prompt;
  const now = new Date();
  const monthYear = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  if (type === "market") {
    prompt = `As of ${monthYear}, is "${item}" currently in high demand in India due to real-world factors such as festivals, holidays, or market trends? Reply ONLY with "yes" or "no" on the first line. Then, in a new line, explain the reason and if possible suggest a percentage increase range (e.g. "increase 10-25%").`;
  } else {
    prompt = `As of ${monthYear}, is "${item}" in high demand in India due to any festival, holiday, or season? Reply ONLY with "increase" if yes, or "no increase" if no. Then, in a new line, explain the reason and if possible suggest a percentage increase range (e.g. "increase 10-25%").`;
  }

  try {
    const answer = await askGemini(prompt);
    console.log("Gemini raw answer:", answer);
    const lines = answer.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = (lines[0] || "").toLowerCase();

    let demand = false;
    let recommendation = type === "market" ? "Trending ↑" : "Seasonal ↑";

    if (type === "market") {
      demand = /\byes\b/.test(firstLine);
      if (!demand) recommendation = "Not trending";
    } else {
      const isNo = /\bno increase\b|\bno\b|\bdecrease\b|out of season/.test(firstLine);
      const isInc = /^(increase|high|yes)\b/.test(firstLine);
      demand = !isNo && isInc;
      if (!demand) recommendation = "Seasonal ↓";
    }
    const reason = lines.slice(1).join(' ').trim() || answer;
    const increaseRange = parsePercentageRange(answer || reason);

    res.json({ demand, reason, recommendation, increaseRange });
  } catch (err) {
    res.status(500).json({ error: "Gemini API error", details: err.message });
  }
});

router.post("/api/chatgpt-seasonal-demand", express.json(), async (req, res) => {
  const type = req.query.type;
  if (type === "list") {
    let prompt = req.body?.prompt;
    if (!prompt) {
      prompt = `List 5 items that are in high demand in India right now and give a short reason for each. Format: name - reason. If possible include a short suggested increase percentage (e.g. 10-25%).`;
    }
    try {
      const answer = await askGemini(prompt);
      console.log("Gemini raw answer:", answer);
      const items = answer
        .split('\n')
        .map(line => line.replace(/^[\-\*\d\.]+\s*/, ''))
        .map(line => {
          const [name, ...reasonArr] = line.split('-');
          const reason = reasonArr.join('-').trim();
          const increaseRange = parsePercentageRange(reason || name);
          return { name: name?.trim(), reason, increaseRange };
        })
        .filter(i => i.name && i.reason);
      return res.json({ items });
    } catch (err) {
      return res.status(500).json({ error: "Gemini API error", details: err.message });
    }
  }
  res.status(400).json({ error: "Invalid request" });
});

export default router;