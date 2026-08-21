// POST /api/generate-recipe
//
// Body: { name, language, plan, meal, ingredients, cuisine, paymentId }
//
// Calls Google Gemini to generate a structured, complete Indian recipe
// based on the user's selections. Returns strict JSON matching the
// shape the frontend expects (see index.html renderRecipe()).
//
// Required Vercel environment variable:
//   GEMINI_API_KEY

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;

const LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil"
};

function buildPrompt({ language, meal, ingredients, cuisine }) {
  const langName = LANGUAGE_NAMES[language] || "English";

  return `You are a professional Indian home-cooking chef. Generate ONE complete, realistic Indian recipe as STRICT JSON only — no markdown, no code fences, no explanation text before or after the JSON.

Requirements:
- Meal type: ${meal}
- State cuisine: ${cuisine}
- Use ONLY these available ingredients wherever realistically possible: ${ingredients.join(", ")}. You may include a few common pantry basics (salt, oil, water) even if not listed.
- Write all text fields (recipeName, ingredient names, instructions, tips) in ${langName}.
- Include exact measurements (e.g. "2 medium, chopped") and exact timings.
- Instructions must be clear, numbered, step-by-step, suitable for a real beginner cook. Avoid vague steps like "cook until done" — give real cues (e.g. "cook 5-6 minutes until golden brown").

Return JSON in EXACTLY this shape:
{
  "recipeName": "string",
  "stateCuisine": "string",
  "mealType": "string",
  "difficulty": "Beginner | Intermediate | Expert",
  "preparationTime": "string, e.g. '10 minutes'",
  "cookingTime": "string, e.g. '20 minutes'",
  "totalTime": "string",
  "servings": "string, e.g. '2 people'",
  "estimatedCost": "string, e.g. '₹80'",
  "calories": "string, e.g. '320 kcal per serving'",
  "ingredients": [ { "name": "string", "quantity": "string" } ],
  "equipment": ["string"],
  "instructions": ["string, one clear step per array item"],
  "nutritionInfo": "string, brief summary",
  "storageTips": "string",
  "reheatingInstructions": "string",
  "ingredientAlternatives": "string",
  "cookingTips": "string",
  "commonMistakes": "string"
}`;
}

async function callGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: HTTP ${res.status} - ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content.");

  return JSON.parse(text);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { name, language, plan, meal, ingredients, cuisine, paymentId } = req.body || {};

  if (!name || !language || !plan || !meal || !ingredients || !ingredients.length || !cuisine || !paymentId) {
    res.status(400).json({ error: "Missing required fields." });
    return;
  }

  if (!GEMINI_API_KEY) {
    res.status(500).json({
      error: "Recipe generation is not configured yet. GEMINI_API_KEY is missing from the server."
    });
    return;
  }

  // NOTE: payment verification is not yet wired in (see _payments.js pattern
  // from the ML Lead Generator project). Once Cashfree keys are added,
  // insert a verifyPayment(paymentId) check here before generating.

  try {
    const prompt = buildPrompt({ language, meal, ingredients, cuisine });
    const recipe = await callGemini(prompt);

    res.status(200).json({ success: true, recipe });
  } catch (err) {
    console.error("generate-recipe error:", err);
    res.status(500).json({
      error: "Something went wrong generating your recipe. Please try again shortly.",
      detail: err.message
    });
  }
};
