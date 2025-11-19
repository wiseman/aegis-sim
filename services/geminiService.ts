import { GoogleGenAI, Type } from "@google/genai";
import { Track, TrackIdentity, TrackType, EngagementStatus } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Generate a random scenario
export const generateScenario = async (): Promise<{
  description: string;
  tracks: Partial<Track>[]
}> => {
  const prompt = `
    You are a naval warfare simulation designer. Create a realistic tactical scenario for an AEGIS cruiser.
    
    Generate a scenario description and a list of 4-6 initial radar contacts (tracks).
    
    Constraints:
    1. Area: 90nm radius.
    2. Mix of commercial air traffic (NEUTRAL) and potential threats (UNKNOWN/HOSTILE).
    3. Threats should not be immediately obvious (start as UNKNOWN).
    4. Positions should be relative X/Y in nautical miles (max 90nm).
    5. Speeds in knots (300-600 for air, 30 for surface).
    6. Altitudes in feet.
    7. Some tracks should be non-responsive (responsive: false), regardless of identity.
    8. Callsigns: SKUNK for unk. surface contacts, BOGEY for unk. air contacts.
    
    Output JSON format only.
  `;

  console.log(`Prompt: ${prompt}`)
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            tracks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  callsign: { type: Type.STRING, description: "e.g. UAL 337, SKUNK 03, BOGEY 01, etc." },
                  position: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER }
                    }
                  },
                  vector: {
                    type: Type.OBJECT,
                    properties: {
                      heading: { type: Type.NUMBER },
                      speed: { type: Type.NUMBER }
                    }
                  },
                  altitude: { type: Type.NUMBER },
                  identity: { type: Type.STRING, enum: ["UNKNOWN", "NEUTRAL", "FRIEND", "HOSTILE"] },
                  type: { type: Type.STRING, enum: ["AIR", "SURFACE"] },
                  responsive: { type: Type.BOOLEAN }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      console.log(JSON.parse(response.text));
      return JSON.parse(response.text);
    }
    throw new Error("Empty response");
  } catch (e) {
    console.error("Failed to generate scenario", e);
    // Fallback scenario
    return {
      description: "Communications failure with simulation server. Loading fallback drill.",
      tracks: [
        {
          callsign: "TN 4012",
          position: { x: 40, y: 40 },
          vector: { heading: 225, speed: 450 },
          altitude: 30000,
          identity: TrackIdentity.UNKNOWN,
          type: TrackType.AIR,
          responsive: false,
        }
      ]
    };
  }
};

// Generate dynamic chatter based on game events
export const generateChatter = async (
  event: string,
  context: string
): Promise<string> => {
  const prompt = `
    You are a scriptwriter for a military simulation. 
    Role: You play the voices of the Combat Information Center (CIC) crew (e.g., OSS, FC, TIC, Bridge).
    Task: Generate a single, short, urgent radio transmission based on the event.
    Style: High military jargon, professional, tense. No fluff.
    
    Event: ${event}
    Context: ${context}
    
    Return just the text of the message.
  `;

  console.log(`Prompt: ${prompt}`);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "Roger that.";
  } catch (e) {
    return "Copy.";
  }
};

// Analyze User Actions for Debriefing
export const generateDebrief = async (
  logs: any[],
  score: number
): Promise<string> => {
  const prompt = `
    Analyze the following tactical logs from a naval engagement simulation and provide a Tactical Action Officer (TAO) debrief.
    Score: ${score} (High is good).
    Logs: ${JSON.stringify(logs.slice(-10))}
    
    Provide a 3 sentence evaluation of the TAO's performance.
  `;

  console.log(`Prompt: ${prompt}`);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "Debrief generation failed.";
  } catch (e) {
    return "Data corrupted. No debrief available.";
  }
};