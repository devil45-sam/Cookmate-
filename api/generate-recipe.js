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
// Payment has been completely removed.
//
// Required Vercel Environment Variable:
//   GEMINI_API_KEY

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL = "gemini-3.6-flash";

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil"
};

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    recipeName: {
      type: "string",
      description: "The name of the recipe."
    },
    stateCuisine: {
      type: "string",
      description: "The Indian state or regional cuisine."
    },
    mealType: {
      type: "string",
      description: "The type of meal."
    },
    difficulty: {
      type: "string",
      enum: ["Beginner", "Intermediate", "Expert"],
      description: "Recipe difficulty."
    },
    preparationTime: {
      type: "string",
      description: "Preparation time, for example 10 minutes."
    },
    cookingTime: {
      type: "string",
      description: "Cooking time, for example 20 minutes."
    },
    totalTime: {
      type: "string",
      description: "Total preparation and cooking time."
    },
    servings: {
      type: "string",
      description: "Serving size, for example 2 people."
    },
    estimatedCost: {
      type: "string",
      description: "Estimated cost in Indian rupees."
    },
    calories: {
      type: "string",
      description: "Estimated calories per serving."
    },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string"
          },
          quantity: {
            type: "string"
          }
        },
        required: ["name", "quantity"]
      }
    },
    equipment: {
      type: "array",
      items: {
        type: "string"
      }
    },
    instructions: {
      type: "array",
      items: {
        type: "string"
      }
    },
    nutritionInfo: {
      type: "string"
    },
    storageTips: {
      type: "string"
    },
    reheatingInstructions: {
      type: "string"
    },
    ingredientAlternatives: {
      type: "string"
    },
    cookingTips: {
      type: "string"
    },
    commonMistakes: {
      type: "string"
    }
  },
  required: [
    "recipeName",
    "stateCuisine",
    "mealType",
    "difficulty",
    "preparationTime",
    "cookingTime",
    "totalTime",
    "servings",
    "estimatedCost",
    "calories",
    "ingredients",
    "equipment",
    "instructions",
    "nutritionInfo",
    "storageTips",
    "reheatingInstructions",
    "ingredientAlternatives",
    "cookingTips",
    "commonMistakes"
  ]
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

  const ingredientList = ingredients.join(", ");

  const dishInstruction = dishHint
    ? `
The user specifically wants something like:
"${dishHint}"

Prioritize this dish or the closest realistic Indian recipe.
`
    : "";

  return `
You are CookMate, a professional Indian home-cooking assistant.

Create ONE realistic Indian recipe for the user.

USER:
Name: ${name}
Language: ${langName}
Meal type: ${meal}
Indian state/regional cuisine: ${cuisine}
Available ingredients: ${ingredientList}
${dishInstruction}

IMPORTANT RULES:

1. Generate exactly ONE recipe.
2. Use the available ingredients wherever realistically possible.
3. You may add common pantry basics such as salt, cooking oil, water and basic spices when necessary.
4. Do not invent unusual ingredients unnecessarily.
5. The recipe must actually be cookable by a beginner.
6. Give realistic quantities.
7. Give realistic preparation and cooking times.
8. Instructions must be numbered through the array.
9. Every instruction must contain a clear action and useful cooking cue.
10. Avoid vague instructions such as "cook until done".
11. Use exact cues such as:
   - "cook for 5-6 minutes"
   - "until the onions turn golden brown"
   - "until the tomatoes become soft"
12. All user-facing text must be written in ${langName}.
13. Keep the recipe practical for an Indian home kitchen.
14. Estimated cost must be in Indian rupees.
15. Calories and nutrition should be reasonable estimates, not medical advice.
16. Return only the requested JSON structure.
17. Do NOT return Markdown.
18. Do NOT wrap the JSON in code fences.
19. Do NOT add explanations outside the JSON.

The output must match the provided JSON schema exactly.
`;
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
        responseMimeType: "application/json",
        responseSchema: RECIPE_SCHEMA
      }
    })
  });

  const responseText = await response.text();

  if (!response.ok) {
    let errorMessage = responseText;

    try {
      const errorData = JSON.parse(responseText);

      errorMessage =
        errorData?.error?.message ||
        errorData?.error?.status ||
        responseText;
    } catch {
      // Keep original response text if it is not JSON.
    }

    throw new Error(
      `Gemini API error (${response.status}): ${errorMessage}`
    );
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error("Gemini returned an invalid API response.");
  }

  const candidate = data?.candidates?.[0];

  if (!candidate) {
    throw new Error("Gemini returned no candidate.");
  }

  if (candidate.finishReason === "SAFETY") {
    throw new Error("Gemini blocked the recipe request for safety reasons.");
  }

  const text = candidate?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned no recipe content.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Gemini returned recipe data that was not valid JSON.");
  }
}

function validateRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") {
    throw new Error("Invalid recipe response.");
  }

  const requiredFields = [
    "recipeName",
    "stateCuisine",
    "mealType",
    "difficulty",
    "preparationTime",
    "cookingTime",
    "totalTime",
    "servings",
    "estimatedCost",
    "calories",
    "ingredients",
    "equipment",
    "instructions",
    "nutritionInfo",
    "storageTips",
    "reheatingInstructions",
    "ingredientAlternatives",
    "cookingTips",
    "commonMistakes"
  ];

  for (const field of requiredFields) {
    if (
      recipe[field] === undefined ||
      recipe[field] === null
    ) {
      throw new Error(`Recipe is missing required field: ${field}`);
    }
  }

  if (!Array.isArray(recipe.ingredients)) {
    throw new Error("Recipe ingredients must be an array.");
  }

  if (!Array.isArray(recipe.instructions)) {
    throw new Error("Recipe instructions must be an array.");
  }

  if (!Array.isArray(recipe.equipment)) {
    throw new Error("Recipe equipment must be an array.");
  }

  return recipe;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // Android / browser preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Only POST is allowed
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST."
    });
  }

  try {
    const body = req.body || {};

    const {
      name,
      language,
      plan,
      meal,
      ingredients,
      cuisine,
      dishHint
    } = body;

    // Validate required fields
    if (!name || typeof name !== "string") {
      return res.status(400).json({
        success: false,
        error: "Name is required."
      });
    }

    if (!language || !LANGUAGE_NAMES[language]) {
      return res.status(400).json({
        success: false,
        error: "A supported language is required."
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

    if (!GEMINI_API_KEY) {
      console.error(
        "GEMINI_API_KEY is not configured in Vercel."
      );

      return res.status(500).json({
        success: false,
        error:
          "Recipe generation is not configured. Please check the server environment."
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

    validateRecipe(recipe);

    return res.status(200).json({
      success: true,
      recipe
    });
  } catch (error) {
    console.error("generate-recipe error:", error);

    return res.status(500).json({
      success: false,
      error:
        "Something went wrong while generating your recipe.",
      detail:
        process.env.NODE_ENV === "production"
          ? "Recipe generation service failed."
          : error.message
    });
  }
};
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
  // CORS: required so the Android app (running on a different origin,
  // typically https://localhost via Capacitor) can call this API.
  // The website itself is unaffected since same-origin requests don't
  // need these headers, but including them is harmless either way.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { name, language, plan, meal, ingredients, cuisine, dishHint, paymentId } = req.body || {};

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
    const prompt = buildPrompt({ language, meal, ingredients, cuisine, dishHint });
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
  // CORS: required so the Android app (running on a different origin,
  // typically https://localhost via Capacitor) can call this API.
  // The website itself is unaffected since same-origin requests don't
  // need these headers, but including them is harmless either way.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

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
