import { NLPProvider, VoiceIntent } from './VoiceProvider';

class LLMVoiceIntentService implements NLPProvider {
  async analyzeIntent(text: string, languageCode: string): Promise<VoiceIntent> {
    const apiKey = process.env.EXPO_PUBLIC_NLP_API_KEY;
    
    if (!apiKey) {
      console.warn('NLP API key not found.');
      throw new Error('NLP API Key not configured. Please add EXPO_PUBLIC_NLP_API_KEY to your environment variables.');
    }

    try {
      // Using OpenAI Chat Completions API as an example
      const systemPrompt = `
You are an intent recognition engine for AgriAgent, an agricultural marketplace app.
Analyze the user's input and extract the intent and parameters.
Language Code: ${languageCode}

Available Intents:
- VIEW_DASHBOARD: Open dashboard
- VIEW_ORDERS: Show orders. Params: date (today, pending, etc.)
- VIEW_FARMERS: Show farmers. Params: status
- VIEW_LOW_STOCK: Show products with low stock. Params: threshold, unit
- ADD_FARMER: Start adding a farmer. Params: name
- CANCEL_ORDER: Cancel an order. Params: orderId
- CHANGE_LANGUAGE: Change app language. Params: languageCode

Return ONLY a valid JSON object matching this schema:
{
  "intent": "INTENT_NAME",
  "parameters": {},
  "confidence": 0.0 to 1.0
}
      `;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo-1106',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`NLP API Error: ${response.statusText}`);
      }

      const result = await response.json();
      const content = result.choices[0].message.content;
      
      try {
        const parsed = JSON.parse(content);
        return {
          intent: parsed.intent || 'UNKNOWN',
          parameters: parsed.parameters || {},
          confidence: parsed.confidence || 0
        };
      } catch (parseError) {
        return { intent: 'UNKNOWN', parameters: {}, confidence: 0 };
      }

    } catch (error) {
      console.error('Error analyzing intent:', error);
      throw error;
    }
  }
}

export const intentService = new LLMVoiceIntentService();
