/**
 * Agri AI assistant + speech-to-text (ports the `agri-ai` Edge Function).
 * API keys stay server-side in backend/.env.
 */
const env = require('../config/env');
const { Farmer, Order } = require('../models');
const { HttpError, badRequest } = require('../utils/http');

const TOOLS = [
  {
    type: 'function',
    function: { name: 'get_dashboard_summary', description: 'Get the total count of farmers and orders for the current agent.', parameters: { type: 'object', properties: {} } },
  },
  {
    type: 'function',
    function: {
      name: 'get_farmers',
      description: 'Get a list of all farmers registered to this agent, including name, location, and crops.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: { name: 'get_recent_orders', description: 'Get the most recent orders (up to 10) for this agent.', parameters: { type: 'object', properties: {} } },
  },
  {
    type: 'function',
    function: {
      name: 'propose_order',
      description: 'Propose creating a new order. Call this if the user wants to create an order.',
      parameters: {
        type: 'object',
        properties: {
          farmer_id: { type: 'string', description: 'The ID of the farmer.' },
          farmer_name: { type: 'string', description: 'Name of the farmer.' },
          product: { type: 'string', description: 'Crop or product name (e.g., Rice, Coconut).' },
          quantity: { type: 'number', description: 'Quantity.' },
          unit: { type: 'string', description: 'Unit of measurement (e.g., kg, quintals).' },
          price: { type: 'number', description: 'Price per unit in INR.' },
        },
        required: ['farmer_id', 'farmer_name', 'product', 'quantity', 'unit', 'price'],
      },
    },
  },
];

const SYSTEM_PROMPT = {
  role: 'system',
  content: `You are Agri AI, a professional agricultural assistant for an Agri Agent.
You help manage farmers, orders, and provide agricultural advice.
Rules:
1. If asked about farmers or orders, always use the provided tools to query real data. Do not hallucinate data.
2. If proposing an order, ensure you have the farmer_id. If you don't know the farmer_id, call get_farmers first to find it.
3. For agricultural advice (e.g., diseases, fertilizers), provide general guidance but explicitly advise consulting a qualified agricultural professional for definitive diagnosis.
4. Never claim to diagnose a disease with certainty.
5. Clearly distinguish when you are citing real app data vs general knowledge.`,
};

const runTool = async (agentId, name) => {
  if (name === 'get_dashboard_summary') {
    const [farmers, orders] = await Promise.all([Farmer.countDocuments({ agent_id: agentId }), Order.countDocuments({ agent_id: agentId })]);
    return { total_farmers: farmers, total_orders: orders };
  }
  if (name === 'get_farmers') {
    const rows = await Farmer.find({ agent_id: agentId }).select('name village district main_crops').limit(200).lean();
    return rows.map((f) => ({ id: String(f._id), name: f.name, village: f.village, district: f.district, crops: f.main_crops }));
  }
  if (name === 'get_recent_orders') {
    const rows = await Order.find({ agent_id: agentId }).select('order_number product quantity status farmer_id').sort({ created_at: -1 }).limit(10).lean();
    const farmers = new Map((await Farmer.find({ _id: { $in: rows.map((r) => r.farmer_id).filter(Boolean) } }).select('name').lean()).map((f) => [String(f._id), f.name]));
    return rows.map((o) => ({ id: String(o._id), order_number: o.order_number, product: o.product, quantity: o.quantity, status: o.status, farmer: farmers.get(String(o.farmer_id)) || null }));
  }
  return { error: `Unknown tool ${name}` };
};

const callLLM = async (messages) => {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.openaiApiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [SYSTEM_PROMPT, ...messages], tools: TOOLS, tool_choice: 'auto' }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.choices?.length) throw new HttpError(502, data.error?.message || 'AI service is temporarily unavailable.');
  return data.choices[0].message;
};

const chat = async (agentId, inputMessages) => {
  if (!Array.isArray(inputMessages) || !inputMessages.length) throw badRequest('messages must be a non-empty array');

  // Only plain user/assistant text from the client; tool plumbing is server-side.
  const messages = inputMessages
    .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!env.openaiApiKey) {
    // Intelligent local assistant fallback using real MongoDB database
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content?.toLowerCase() || '';
    
    if (lastUserMsg.includes('summary') || lastUserMsg.includes('dashboard') || lastUserMsg.includes('count')) {
      const summary = await runTool(agentId, 'get_dashboard_summary');
      return {
        reply: `📊 Here is your current operations summary:\n• Total Registered Farmers: ${summary.total_farmers}\n• Total Orders: ${summary.total_orders}`,
        proposedAction: null
      };
    }
    
    if (lastUserMsg.includes('farmer') || lastUserMsg.includes('kisan')) {
      const farmers = await runTool(agentId, 'get_farmers');
      if (!farmers.length) {
        return { reply: "You don't have any registered farmers yet. You can register a new farmer from the Farmers menu.", proposedAction: null };
      }
      const list = farmers.slice(0, 5).map(f => `• ${f.name} (${f.village || f.district || 'Location N/A'}) - Crops: ${Array.isArray(f.crops) ? f.crops.join(', ') : (f.crops || 'None')}`).join('\n');
      return {
        reply: `🌾 Here are your registered farmers (${farmers.length} total):\n${list}${farmers.length > 5 ? `\n...and ${farmers.length - 5} more.` : ''}`,
        proposedAction: null
      };
    }

    if (lastUserMsg.includes('order')) {
      const orders = await runTool(agentId, 'get_recent_orders');
      if (!orders.length) {
        return { reply: "You don't have any recent orders yet.", proposedAction: null };
      }
      const list = orders.slice(0, 5).map(o => `• Order #${o.order_number || o.id.slice(-6)}: ${o.quantity}kg ${o.product} (${o.status})`).join('\n');
      return {
        reply: `📦 Here are your recent orders:\n${list}`,
        proposedAction: null
      };
    }

    return {
      reply: "Hello! I am Agri AI, your agricultural operations assistant.\n\nI can help you with:\n• Operations summary ('Give me a dashboard summary')\n• Registered farmers ('Show my farmers')\n• Recent orders ('Show recent orders')\n• Navigation & Logistics via voice commands",
      proposedAction: null
    };
  }

  let message = await callLLM(messages);
  let proposedAction = null;

  if (message.tool_calls?.length) {
    messages.push(message);
    for (const call of message.tool_calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        args = {};
      }
      let result;
      if (call.function.name === 'propose_order') {
        result = { status: 'staged_for_user_confirmation', ...args };
        proposedAction = { intent: 'CREATE_ORDER', ...args };
      } else {
        try {
          result = await runTool(agentId, call.function.name);
        } catch (err) {
          result = { error: err.message };
        }
      }
      messages.push({ tool_call_id: call.id, role: 'tool', name: call.function.name, content: JSON.stringify(result) });
    }
    message = await callLLM(messages);
  }

  return { reply: message.content, proposedAction };
};

const transcribe = async (audioBase64, languageCode) => {
  if (!env.sarvamApiKey) throw new HttpError(503, 'Speech service is not configured. SARVAM_API_KEY is missing.');
  if (typeof audioBase64 !== 'string' || !audioBase64) throw badRequest('audioData is required');

  const bytes = Buffer.from(audioBase64, 'base64');
  let mimeType = 'audio/x-m4a';
  let filename = 'audio.m4a';
  if (bytes.length > 4 && bytes.slice(0, 4).toString('ascii') === 'RIFF') {
    mimeType = 'audio/wav';
    filename = 'audio.wav';
  } else if (bytes.length > 3 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    mimeType = 'audio/mpeg';
    filename = 'audio.mp3';
  } else if (bytes.length > 4 && bytes.slice(0, 4).toString('hex') === '1a45dfa3') {
    mimeType = 'audio/webm';
    filename = 'audio.webm';
  } else if (bytes.length > 4 && bytes.slice(0, 4).toString('ascii') === 'OggS') {
    mimeType = 'audio/ogg';
    filename = 'audio.ogg';
  }

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mimeType }), filename);
  form.append('model', 'saaras:v3');

  const res = await fetch('https://api.sarvam.ai/speech-to-text-translate', {
    method: 'POST',
    headers: { 'api-subscription-key': env.sarvamApiKey },
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    console.error(`[ai] Sarvam error ${res.status}:`, errorBody);
    throw new HttpError(502, 'Failed to transcribe audio.');
  }
  const result = await res.json();
  return { 
    transcription: result.transcript || '',
    detectedLanguage: result.language_code || 'en-IN'
  };
};

module.exports = { chat, transcribe };
