// POST /api/generate-recipe
//
// Body:
// {
//   name,
//   language,
//   plan,
//   meal,
//   ingredients,
//   cuisine,
//   dishHint
// }
//
// Generates one complete Indian recipe using Google Gemini.
//
// Required Vercel environment variable:
// GEMINI_API_KEY

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL = "gemini-3.6-flash";

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil"
};

function buildPrompt({
  name,
  language,
  meal,
  ingredients,
  cuisine,
  dishHint
}) {
  const langName = LANGUAGE_NAMES[language] || "English";

  const dishLine = dishHint
    ? `
The user specifically wants a dish like:
"${dishHint}"

Prioritize this dish or the closest realistic match.
`
    : "";

  return `You are a professional Indian home-cooking chef.

Generate ONE complete, realistic Indian recipe as STRICT JSON only.

Do not use Markdown.
Do not use code fences.
Do not add any explanation outside the JSON.

User name: ${name}
Language: ${langName}
Meal type: ${meal}
State / regional cuisine: ${cuisine}

${dishLine}

Available ingredients:
${ingredients.join(", ")}

Rules:

- Use the available ingredients wherever realistically possible.
- You may add common pantry basics such as salt, oil, water and basic spices.
- Do not add unnecessary or unusual ingredients.
- The recipe must be practical for a real Indian home kitchen.
- The recipe must be suitable for a beginner.
- Give realistic measurements.
- Give realistic preparation and cooking times.
- Give clear numbered instructions.
- Every instruction must contain a useful cooking cue.
- Avoid vague instructions such as "cook until done".
- Use cues such as "cook for 5-6 minutes until the onions turn golden brown".
- Write all recipe text in ${langName}.
- Estimated cost must be in Indian rupees.
- Calories should be a reasonable estimate.

Return EXACTLY this JSON structure:

{
  "recipeName": "string",
  "stateCuisine": "string",
  "mealType": "string",
  "difficulty": "Beginner | Intermediate | Expert",
  "preparationTime": "string, e.g. 10 minutes",
  "cookingTime": "string, e.g. 20 minutes",
  "totalTime": "string",
  "servings": "string, e.g. 2 people",
  "estimatedCost": "string, e.g. ₹80",
  "calories": "string, e.g. 320 kcal per serving",
  "ingredients": [
    {
      "name": "string",
      "quantity": "string"
    }
  ],
  "equipment": [
    "string"
  ],
  "instructions": [
    "string"
  ],
  "nutritionInfo": "string",
  "storageTips": "string",
  "reheatingInstructions": "string",
  "ingredientAlternatives": "string",
  "cookingTips": "string",
  "commonMistakes": "string"
}`;
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing from Vercel Environment Variables."
    );
  }

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  const responseText = await response.text();

  if (!response.ok) {
    let message = responseText;

    try {
      const errorData = JSON.parse(responseText);

      message =
        errorData?.error?.message ||
        errorData?.error?.status ||
        responseText;
    } catch {
      // Keep original response if it is not JSON.
    }

    throw new Error(
      `Gemini API error: HTTP ${response.status} - ${message}`
    );
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "Gemini returned an invalid API response."
    );
  }

  const candidate = data?.candidates?.[0];

  if (!candidate) {
    const blockReason =
      data?.promptFeedback?.blockReason;

    throw new Error(
      blockReason
        ? `Gemini blocked the request: ${blockReason}`
        : "Gemini returned no candidate."
    );
  }

  const parts = candidate?.content?.parts || [];

  const text = parts
    .map((part) => part?.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error(
      `Gemini returned no recipe content. Finish reason: ${
        candidate?.finishReason || "unknown"
      }`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Gemini returned recipe content that could not be parsed as JSON."
    );
  }
}

module.exports = async (req, res) => {
  // CORS for the Android/Capacitor app
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // Android/browser preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Only POST is allowed
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed."
    });
  }

  try {
    const {
      name,
      language,
      plan,
      meal,
      ingredients,
      cuisine,
      dishHint
    } = req.body || {};

    // Validate request
    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Name is required."
      });
    }

    if (!language || !LANGUAGE_NAMES[language]) {
      return res.status(400).json({
        success: false,
        error: "Valid language is required."
      });
    }

    if (!plan) {
      return res.status(400).json({
        success: false,
        error: "Plan is required."
      });
    }

    if (!meal) {
      return res.status(400).json({
        success: false,
        error: "Meal type is required."
      });
    }

    if (!cuisine) {
      return res.status(400).json({
        success: false,
        error: "Cuisine is required."
      });
    }

    if (
      !Array.isArray(ingredients) ||
      ingredients.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "At least one ingredient is required."
      });
    }

    const prompt = buildPrompt({
      name,
      language,
      meal,
      ingredients,
      cuisine,
      dishHint
    });

    const recipe = await callGemini(prompt);

    return res.status(200).json({
      success: true,
      recipe
    });

  } catch (error) {
    console.error(
      "generate-recipe error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Something went wrong generating your recipe. Please try again shortly.",
      detail: error.message
    });
  }
};
