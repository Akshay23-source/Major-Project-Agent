import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("AI is not configured. OPENAI_API_KEY is missing.");
    }

    const payload = await req.json();
    
    // Check if this is a STT transcription request
    if (payload.audioData) {
      const sarvamApiKey = Deno.env.get("SARVAM_API_KEY");
      if (!sarvamApiKey) {
        throw new Error("Server-side Sarvam configuration missing");
      }
      
      const byteCharacters = atob(payload.audioData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const audioBlob = new Blob([byteArray], { type: 'audio/m4a' });
      
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.m4a');
      formData.append('model', 'saaras:v1');
      
      const response = await fetch('https://api.sarvam.ai/speech-to-text-translate', {
        method: 'POST',
        headers: {
          'api-subscription-key': sarvamApiKey
        },
        body: formData
      });
      
      if (!response.ok) {
        console.error(`Sarvam API Error: ${response.status} ${response.statusText}`);
        throw new Error("Failed to transcribe audio via Sarvam.");
      }
      
      const result = await response.json();
      return new Response(JSON.stringify({ transcription: result.transcript || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = payload.messages;
    if (!messages || !Array.isArray(messages)) {
      throw new Error("Invalid request payload.");
    }

    // Initialize Supabase Client with the user's Auth context
    const authHeader = req.headers.get("Authorization");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Tools definition
    const tools = [
      {
        type: "function",
        function: {
          name: "get_dashboard_summary",
          description: "Get the total count of farmers and orders for the current agent.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "get_farmers",
          description: "Get a list of all farmers registered to this agent, including name, location, and crops.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "get_recent_orders",
          description: "Get the most recent orders (up to 10) for this agent.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_order",
          description: "Propose creating a new order. Call this if the user wants to create an order.",
          parameters: {
            type: "object",
            properties: {
              farmer_id: { type: "string", description: "The ID of the farmer." },
              farmer_name: { type: "string", description: "Name of the farmer." },
              product: { type: "string", description: "Crop or product name (e.g., Rice, Coconut)." },
              quantity: { type: "number", description: "Quantity." },
              unit: { type: "string", description: "Unit of measurement (e.g., kg, quintals)." },
              price: { type: "number", description: "Price per unit in INR." },
            },
            required: ["farmer_id", "farmer_name", "product", "quantity", "unit", "price"],
          },
        },
      },
    ];

    const systemPrompt = {
      role: "system",
      content: `You are Agri AI, a professional agricultural assistant for an Agri Agent. 
      You help manage farmers, orders, and provide agricultural advice.
      Rules:
      1. If asked about farmers or orders, always use the provided tools to query real data. Do not hallucinate data.
      2. If proposing an order, ensure you have the farmer_id. If you don't know the farmer_id, call get_farmers first to find it.
      3. For agricultural advice (e.g., diseases, fertilizers), provide general guidance but explicitly advise consulting a qualified agricultural professional for definitive diagnosis.
      4. Never claim to diagnose a disease with certainty.
      5. Clearly distinguish when you are citing real app data vs general knowledge.`
    };

    const callLLM = async (messagesArray: any[]) => {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [systemPrompt, ...messagesArray],
          tools,
          tool_choice: "auto",
        }),
      });
      return response.json();
    };

    let chatResponse = await callLLM(messages);
    let message = chatResponse.choices[0].message;

    // Handle Tool Calls
    if (message.tool_calls) {
      messages.push(message); // append assistant's tool call

      for (const toolCall of message.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let functionResult = "";

        try {
          if (functionName === "get_dashboard_summary") {
            const { count: fCount } = await supabaseClient.from("farmers").select("*", { count: "exact", head: true });
            const { count: oCount } = await supabaseClient.from("orders").select("*", { count: "exact", head: true });
            functionResult = JSON.stringify({ total_farmers: fCount || 0, total_orders: oCount || 0 });
          } 
          else if (functionName === "get_farmers") {
            const { data } = await supabaseClient.from("farmers").select("id, name, village, district, crops");
            functionResult = JSON.stringify(data || []);
          } 
          else if (functionName === "get_recent_orders") {
            const { data } = await supabaseClient.from("orders").select("id, order_number, product, quantity, status, farmers(name)").order("created_at", { ascending: false }).limit(10);
            functionResult = JSON.stringify(data || []);
          } 
          else if (functionName === "propose_order") {
            // We don't execute it, we just return a structured proposal format back to the client.
            // We tell the LLM that the proposal was staged.
            functionResult = JSON.stringify({ status: "staged_for_user_confirmation", ...args });
          }
        } catch (e: any) {
          functionResult = JSON.stringify({ error: e.message });
        }

        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: functionResult,
        });
      }

      // Second call to get final response after tool execution
      chatResponse = await callLLM(messages);
      message = chatResponse.choices[0].message;
    }

    // Check if the LLM made a proposal that we should pass to the frontend as structured data
    let proposedAction = null;
    const previousToolCalls = messages.find(m => m.tool_calls);
    if (previousToolCalls && previousToolCalls.tool_calls) {
       const proposal = previousToolCalls.tool_calls.find((tc: any) => tc.function.name === "propose_order");
       if (proposal) {
         proposedAction = {
           intent: "CREATE_ORDER",
           ...JSON.parse(proposal.function.arguments)
         };
       }
    }

    return new Response(JSON.stringify({ reply: message.content, proposedAction }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in agri-ai:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
