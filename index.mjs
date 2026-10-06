// AWS Lambda (Node 20+) with a Function URL. Env vars: GEMINI_API_KEY, ALLOWED_ORIGIN, GEMINI_MODEL (optional)
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const cors = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json"
};
const reply = (code, obj) => ({ statusCode: code, headers: cors, body: JSON.stringify(obj) });
const clip = (s, n) => String(s || "").slice(0, n);
const list = a => (Array.isArray(a) ? a : []).slice(0, 10).map(x => clip(x, 40));
const pick = a => a[Math.floor(Math.random() * a.length)];

const SYSTEM = `You help a real restaurant customer put their own experience into words.
Write a first-person Google review draft using ONLY the details provided.
Never invent dishes, staff names, prices, dates, or any facts not given.
Match the tone honestly to the star rating: do not soften a low rating or inflate a high one. For low ratings, be factual and civil.
No emojis, hashtags, or mention of AI. Avoid cliché openers like "Had an amazing experience".
Output only the review text.`;

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") return { statusCode: 204, headers: cors };
  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Bad JSON" }); }
  const stars = Number(b.stars);
  if (!(stars >= 1 && stars <= 5)) return reply(400, { error: "Invalid stars" });

  const length = pick(["1-2 short sentences", "2-3 sentences", "3-4 sentences"]);
  const style = pick(["casual and conversational", "warm and polite", "plain and direct", "enthusiastic but natural"]);
  const prompt = `Restaurant: ${clip(b.restaurant, 80)} (${clip(b.cuisine, 40)})
Stars: ${stars}/5
Customer liked: ${list(b.liked).join(", ") || "nothing specific"}
Customer was not happy with: ${list(b.disliked).join(", ") || "nothing specific"}
Dish mentioned: ${clip(b.dish, 80) || "none"}
Customer's own words: ${clip(b.note, 200) || "none"}
Length: ${length}. Style: ${style}.`;

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0, maxOutputTokens: 300 }
      })
    });
    const data = await r.json();
    const review = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!review) return reply(502, { error: "No output" });
    return reply(200, { review });
  } catch (e) {
    return reply(500, { error: "Server error" });
  }
};
