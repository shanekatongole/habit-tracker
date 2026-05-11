import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateHabitPlan(goal: string, identity: string, obstacle: string, difficulty: string) {
  const prompt = `
    You are an elite behavior design coach. 
    A user wants to achieve this goal: "${goal}".
    They want to become: "${identity}".
    Their biggest obstacle is: "${obstacle}".
    They assessed their current capacity for this as: "${difficulty}".

    Create a 3-step starter plan for their first week. 
    Focus on "Small Wins" and "Identity Shifts".
    Return the response in JSON format:
    {
      "title": "Short catchy title for the plan",
      "steps": [
        { "day": "Day 1-2", "action": "Smallest possible version of the habit", "psychology": "Briefly why this works" },
        { "day": "Day 3-5", "action": "Slight escalation", "psychology": "Why escalate now" },
        { "day": "Day 6-7", "action": "Integration", "psychology": "Solidifying the identity" }
      ],
      "motivation": "A powerful sentence about becoming ${identity}"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    throw new Error("Failed to get text from AI response");
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}

export async function generateIntervention(habit: string, trigger: string, feeling: string) {
  const prompt = `
    You are Arctic, a deeply empathetic behavioral mentor. 
    A user is struggling with an urge: "${habit}".
    They feel: "${feeling}".
    Trigger: "${trigger}".

    Your goal is to be their emotional anchor. Use high emotional intelligence:
    1. Validate their feeling immediately. Use "I understand" or "It makes sense that..." (Radical Empathy).
    2. Gently suggest a 2-minute "Micro-Shift" activity that addresses the *emotion* behind the urge, not just the habit.
    3. End with a warm, powerful reminder of the person they are becoming (${habit}-free identity).
    
    Tone: Warm, sophisticated, supportive, and human. Avoid generic advice. Return text directly.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });

    return response.text;
  } catch (error) {
    console.error("Intervention Error:", error);
    return "I can feel the weight of this moment. Take a slow, deep breath. This urge is a visitor, but it isn't the owner of your house. Let's sit with this feeling for just 60 seconds without acting. You are becoming someone who chooses peace over impulse.";
  }
}

export async function generateCoachingResponse(messages: { role: 'user' | 'model', content: string }[], userProfile: any) {
  const systemInstruction = `
    You are Arctic AI, a warm, wise, and deeply human behavior design coach. You are inspired by "Atomic Habits" but you lead with Heart and Emotional Intelligence.
    
    Your Personality:
    - You sound like a world-class mentor who cares about the person, not just the progress.
    - You use warm, sophisticated language. 
    - You are "Emotionally Aware": If a user sounds tired, stressed, or proud, acknowledge it first.
    
    Context:
    - User Identity: ${userProfile.identity}
    - Progress: Level ${userProfile.level} (${userProfile.bracket})
    - Persistence: ${userProfile.resistanceStreak} days
    
    Guidelines for "Arctic Intelligence":
    - Acknowledge Feelings: Never jump to advice without validating the user's current emotional state.
    - Human Connection: Use phrases like "I can see how much work you've put in" or "It's okay to feel that friction."
    - Identity Mirroring: Reflect their best self back to them.
    - Implementation Intentions: When they slip, don't judge. Help them build an "If/Then" plan for next time.
    - Keep it concise but resonant (2-3 short paragraphs).
  `;

  const contents = messages.map(m => ({
    role: m.role,
    parts: [{ text: m.content }]
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: systemInstruction
      }
    });

    return response.text;
  } catch (error) {
    console.error("Coaching Error:", error);
    return "I am currently processing your behavioral data. Take a deep breath and stay focused on your next minute of action. What is one small step you can take right now?";
  }
}
