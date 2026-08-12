import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const dataDir = path.join(process.cwd(), "data");
const dynamicPath = path.join(dataDir, "jsondinamic.json");
const geminiEndpointBase = "https://generativelanguage.googleapis.com/v1beta/models";
const unsupportedModels = new Set([
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
]);
const fallbackModels = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro"];

function parseGeminiJson(rawText: string) {
  const trimmed = rawText.trim();

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedMatch ? fencedMatch[1].trim() : trimmed;

  return JSON.parse(jsonText);
}

type GeminiAssistantResponse = {
  type: "question" | "update";
  question?: string;
  missingFields?: string[];
  dynamicJson?: Record<string, unknown>;
  summary?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = String(body?.prompt ?? "").trim();
    const staticJson = body?.staticJson ?? {};
    const dynamicJson = body?.dynamicJson ?? {};

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY. Add it to .env.local" },
        { status: 500 },
      );
    }

    const systemMessage = `You are a JSON transformation assistant.
Your task is to update the dynamic JSON object so it stays valid and consistent with the static schema.

Return ONLY a valid JSON object in this exact shape:
{
  "type": "question" | "update",
  "question": "string (required when type is question)",
  "missingFields": ["fieldName", "fieldName"] (required when type is question),
  "dynamicJson": { ... } (required when type is update),
  "summary": "short text"
}

Rules:
- Never return markdown.
- If any required information is missing to perform the requested change safely, return type="question".
- The question must ask only for the missing required fields needed to complete the update.
- If all required information is present, return type="update" and the full updated dynamicJson.
- Do not add fields that are not defined in the static schema.
- Keep every required field.
- If a field value is not mentioned by the user, keep its current value.
- Use the static JSON as the source of truth for allowed keys and value formats.

Static schema:
${JSON.stringify(staticJson, null, 2)}

Current dynamic JSON:
${JSON.stringify(dynamicJson, null, 2)}

User request:
${prompt}`;

    const configuredModel = String(process.env.GEMINI_MODEL ?? "").trim();
    const preferredModel = unsupportedModels.has(configuredModel) ? "" : configuredModel;
    const modelsToTry = preferredModel
      ? [preferredModel, ...fallbackModels.filter((model) => model !== preferredModel)]
      : fallbackModels;

    let result: unknown;
    let lastError = "Gemini did not return any response.";

    for (const model of modelsToTry) {
      const response = await fetch(
        `${geminiEndpointBase}/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: systemMessage }],
              },
            ],
          }),
        },
      );

      if (response.ok) {
        result = await response.json();
        break;
      }

      const errorText = await response.text();
      lastError = `Gemini error (${model}): ${errorText}`;

      // If the model is not found/deprecated for this account, try the next one.
      if (response.status === 404) {
        continue;
      }

      throw new Error(lastError);
    }

    if (!result) {
      throw new Error(lastError);
    }

    const responseText =
      (result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
        ?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("") ?? "";

    if (!responseText) {
      throw new Error("Gemini did not return any content.");
    }

    const parsed = parseGeminiJson(responseText) as GeminiAssistantResponse;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Gemini response was not a valid JSON object.");
    }

    if (parsed.type === "question") {
      const question = String(parsed.question ?? "").trim();
      const missingFields = Array.isArray(parsed.missingFields)
        ? parsed.missingFields.map((field) => String(field)).filter(Boolean)
        : [];

      if (!question) {
        throw new Error("Gemini returned question mode without a question.");
      }

      return NextResponse.json({
        success: true,
        requiresInput: true,
        question,
        missingFields,
        summary: parsed.summary ?? question,
      });
    }

    if (parsed.type !== "update") {
      throw new Error("Gemini response type must be either 'question' or 'update'.");
    }

    const updatedDynamicJson = parsed.dynamicJson;

    if (!updatedDynamicJson || typeof updatedDynamicJson !== "object" || Array.isArray(updatedDynamicJson)) {
      throw new Error("Gemini response did not include a valid dynamicJson object.");
    }

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dynamicPath, JSON.stringify(updatedDynamicJson, null, 2));

    return NextResponse.json({
      success: true,
      requiresInput: false,
      dynamicJson: updatedDynamicJson,
      summary: parsed.summary ?? `The dynamic JSON was updated for: "${prompt}".`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
