import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// IMPORTANT: Accessing process.env.API_KEY as strictly required.
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateAIResponse = async (
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  newMessage: string
): Promise<string> => {
  if (!apiKey) {
    return "Configuration Error: API_KEY is missing in the environment variables.";
  }

  try {
    const model = 'gemini-3-flash-preview';
    
    // Transform history to Gemini format if needed, though simpler is to just send context + prompt for stateless or manage chat state
    // For a simple chat implementation, we will use the chat helper
    const chat = ai.chats.create({
      model: model,
      history: history,
      config: {
        systemInstruction: "You are Chitchat AI, a helpful, witty, and concise assistant within a messaging app. Keep responses brief and conversational like a chat message.",
      }
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "I'm speechless right now.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I'm having trouble connecting to my brain right now.";
  }
};
