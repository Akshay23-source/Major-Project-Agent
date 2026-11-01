import { NLPProvider, VoiceIntent } from './VoiceProvider';

function matchLocalIntent(text: string): VoiceIntent {
  const lower = text.toLowerCase().trim();

  // Language switching voice commands
  if (/kannada|ಕನ್ನಡ|kannadalli/i.test(lower)) {
    return { intent: 'CHANGE_LANGUAGE_TO', parameters: { lang: 'kn' }, confidence: 0.95 };
  }
  if (/hindi|हिन्दी|हिंदी|hindi mein/i.test(lower)) {
    return { intent: 'CHANGE_LANGUAGE_TO', parameters: { lang: 'hi' }, confidence: 0.95 };
  }
  if (/tamil|தமிழ்|tamilil/i.test(lower)) {
    return { intent: 'CHANGE_LANGUAGE_TO', parameters: { lang: 'ta' }, confidence: 0.95 };
  }
  if (/telugu|తెలుగు/i.test(lower)) {
    return { intent: 'CHANGE_LANGUAGE_TO', parameters: { lang: 'te' }, confidence: 0.95 };
  }
  if (/marathi|मराठी/i.test(lower)) {
    return { intent: 'CHANGE_LANGUAGE_TO', parameters: { lang: 'mr' }, confidence: 0.95 };
  }
  if (/gujarati|ગુજરાતી/i.test(lower)) {
    return { intent: 'CHANGE_LANGUAGE_TO', parameters: { lang: 'gu' }, confidence: 0.95 };
  }
  if (/bengali|bangla|বাংলা/i.test(lower)) {
    return { intent: 'CHANGE_LANGUAGE_TO', parameters: { lang: 'bn' }, confidence: 0.95 };
  }
  if (/punjabi|ਪੰਜਾਬੀ/i.test(lower)) {
    return { intent: 'CHANGE_LANGUAGE_TO', parameters: { lang: 'pa' }, confidence: 0.95 };
  }
  if (/malayalam|മലയാളം/i.test(lower)) {
    return { intent: 'CHANGE_LANGUAGE_TO', parameters: { lang: 'ml' }, confidence: 0.95 };
  }
  if (/english|angrezi|english please/i.test(lower)) {
    return { intent: 'CHANGE_LANGUAGE_TO', parameters: { lang: 'en' }, confidence: 0.95 };
  }

  // 1. In-Transit / Live Tracking / GPS Map
  if (/transit|in[- ]?transit|tracking|live tracking|track driver|track delivery|track vehicle|gps|live map|track fleet|location|route map|ट्रैकिंग|लाइव ट्रैकिंग|ट्रांजिट|गाड़ी|ನಕ್ಷೆ|ಟ್ರ್ಯಾಕಿಂಗ್|கண்காணிப்பு|ట్రాకింగ్|vahan track|gaadi track/i.test(lower)) {
    return { intent: 'VIEW_LIVE_TRACKING', parameters: {}, confidence: 0.95 };
  }

  // 2. Notifications & Alerts
  if (/notif|notification|notifications|alert|alerts|update|updates|suchana|soochana|सूचना|अधिसूचना|ಅಧಿಸೂಚನೆ|ಸೂಚನೆ|அறிவிப்பு|నోటిఫికేషన్/i.test(lower)) {
    return { intent: 'VIEW_NOTIFICATIONS', parameters: {}, confidence: 0.95 };
  }

  // 3. Edit Profile
  if (/edit profile|update profile|change profile|modify profile|प्रोफ़ाइल बदलें|ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ|சுயவிவரம் திருத்து/i.test(lower)) {
    return { intent: 'EDIT_PROFILE', parameters: {}, confidence: 0.95 };
  }

  // 4. View Profile / Account
  if (/open profile|my profile|view profile|show profile|agent profile|account details|my account|\bprofile\b|\baccount\b|प्रोफ़ाइल|प्रोफाइल|खाता|ಪ್ರೊಫೈಲ್|ಖಾತೆ|விவரக்குறிப்பு|சுயவிவரம்|ప్రొఫైల్|ఖాతా/i.test(lower)) {
    return { intent: 'VIEW_PROFILE', parameters: {}, confidence: 0.95 };
  }

  // 5. Security & Password
  if (/security|security settings|password|change password|\bpin\b|सुरक्षा|पासवर्ड|ಪಾಸ್‌ವರ್ಡ್|கடவுச்சொல்|పాస్‌వర్డ్/i.test(lower)) {
    return { intent: 'VIEW_SECURITY', parameters: {}, confidence: 0.95 };
  }

  // 6. Language & Settings
  if (/language|change language|switch language|select language|bhasha|भाषा|ಭಾಷೆ|மொழி|భాష/i.test(lower)) {
    return { intent: 'CHANGE_LANGUAGE', parameters: {}, confidence: 0.95 };
  }
  if (/settings|setting|preferences|preference|config|\bsettings\b|सेटिंग्स|सेटिंग|ಸೆಟ್ಟಿಂಗ್|அமைப்புகள்|సెట్టింగులు/i.test(lower)) {
    return { intent: 'VIEW_SETTINGS', parameters: {}, confidence: 0.95 };
  }

  // 7. Add Farmer
  if (/add farmer|new farmer|register farmer|create farmer|add kisan|किसान जोड़ें|ರೈತರನ್ನು ಸೇರಿಸಿ|விவசாயி சேர்/i.test(lower)) {
    return { intent: 'ADD_FARMER', parameters: {}, confidence: 0.95 };
  }

  // 8. Farmers Directory
  if (/farmer|farmers|kisan|grower|growers|raitharu|raitha|vivasaayi|rythulu|rythu|shetkari|krishok|khedut|किसान|कृषक|शेतकरी|రైతులు|ರೈತರು|ರೈತ|விவசாயிகள்|விவசாயி|రైతు/i.test(lower)) {
    return { intent: 'VIEW_FARMERS', parameters: {}, confidence: 0.95 };
  }

  // 9. Add Buyer
  if (/add buyer|new buyer|register buyer|create buyer|खरीदार जोड़ें/i.test(lower)) {
    return { intent: 'ADD_BUYER', parameters: {}, confidence: 0.95 };
  }

  // 10. Buyers List
  if (/buyer|buyers|customer|customers|client|clients|trader|traders|vyapari|grahak|खरीदार|व्यापारी|ग्राहक|ಖರೀದಿದಾರರು|வாங்குபவர்கள்|కొనుగోలుదారులు/i.test(lower)) {
    return { intent: 'VIEW_BUYERS', parameters: {}, confidence: 0.95 };
  }

  // 11. Add Product / Stock
  if (/add product|new product|add crop|new crop|add stock|फसल जोड़ें|ಉತ್ಪನ್ನ ಸೇರಿಸಿ/i.test(lower)) {
    return { intent: 'ADD_PRODUCT', parameters: {}, confidence: 0.95 };
  }

  // 12. Products & Inventory
  if (/product|products|inventory|stock|stocks|produce|crop|crops|supplies|low stock|उत्पाद|फसल|माल|स्टॉक|ಇನ್ವೆಂಟರಿ|ಉತ್ಪನ್ನಗಳು|ದಾಸ್ತಾನು|பொருட்கள்|பயிர்கள்|ఉత్పత్తులు|పంటలు/i.test(lower)) {
    return { intent: 'VIEW_PRODUCTS', parameters: {}, confidence: 0.95 };
  }

  // 13. Create Order
  if (/create order|new order|add order|place order|make order|नया ऑर्डर|ಹೊಸ ಆರ್ಡರ್|புதிய ஆர்டர்/i.test(lower)) {
    return { intent: 'CREATE_ORDER', parameters: {}, confidence: 0.95 };
  }

  // 14. Cancel Order
  if (/cancel order|delete order|drop order|ऑर्डर रद्द/i.test(lower)) {
    return { intent: 'CANCEL_ORDER', parameters: {}, confidence: 0.95 };
  }

  // 15. Orders List
  if (/order|orders|ऑर्डर|आर्डर|ಆರ್ಡರ್‌ಗಳು|ಆರ್ಡರ್|ஆர்டர்கள்|ஆர்டர்|ఆర్డర్లు|ఆర్డర్/i.test(lower)) {
    return { intent: 'VIEW_ORDERS', parameters: {}, confidence: 0.95 };
  }

  // 16. Add Delivery
  if (/new delivery|add delivery|create delivery|new dispatch|assign delivery/i.test(lower)) {
    return { intent: 'ADD_DELIVERY', parameters: {}, confidence: 0.95 };
  }

  // 17. Deliveries
  if (/deliveries|delivery|dispatch|dispatches|डिलीवरी|वैकल्पिक|ವಿತರಣೆಗಳು|ವಿತರಣೆ|டெலிவரி|డెలివరీ/i.test(lower)) {
    return { intent: 'VIEW_DELIVERIES', parameters: {}, confidence: 0.95 };
  }

  // 18. Delivery Partners / Drivers
  if (/delivery partner|delivery partners|driver|drivers|courier|couriers|rider|riders|chalak|chalaka|ootunar|ड्राइवर|चालक|ಚಾಲಕರು|ಚಾಲಕ|ஓட்டுநர்|డ్రైవర్/i.test(lower)) {
    return { intent: 'VIEW_DELIVERY_PARTNERS', parameters: {}, confidence: 0.95 };
  }

  // 19. Fleet / Vehicles
  if (/fleet|vehicle|vehicles|truck|trucks|van|vans|tempo|transport|vahan|vahana|gaadi|वाहन|गाड़ियां|गाडी|ವಾಹನಗಳು|ವಾಹನ|வாகனங்கள்|வாகனம்|వాహనాలు|వాహనం/i.test(lower)) {
    return { intent: 'VIEW_FLEET', parameters: {}, confidence: 0.95 };
  }

  // 20. Settlements
  if (/settlement|settlements|farmer settlement|निपटान|हिसाब|ಇತ್ಯರ್ಥ|செட்டில்மெண்ட்/i.test(lower)) {
    return { intent: 'VIEW_SETTLEMENTS', parameters: {}, confidence: 0.95 };
  }

  // 21. Payments & Transactions
  if (/payment|payments|transaction|transactions|payout|payouts|billing|paid|paisa|paise|hana|भुगतान|पैसे|रकम|ಪಾವತಿಗಳು|ಪಾವತಿ|ಹಣ|கொடுப்பனவு|கட்டணம்|చెల్లింపులు|డబ్బులు/i.test(lower)) {
    return { intent: 'VIEW_PAYMENTS', parameters: {}, confidence: 0.95 };
  }

  // 22. Earnings & Commission
  if (/earning|earnings|commission|commissions|revenue|income|profit|कमाई|मुनाफा|कमीशन|ಗಳಿಕೆ|வருமானம்|ఆదాయం/i.test(lower)) {
    return { intent: 'VIEW_EARNINGS', parameters: {}, confidence: 0.95 };
  }

  // 23. Reports & Analytics
  if (/report|reports|analytics|statistic|statistics|stats|kpi|kpis|metrics|performance|रिपोर्ट|विश्लेषण|ವರದಿಗಳು|ವರದಿ|அறிக்கைகள்|నివేదికలు/i.test(lower)) {
    return { intent: 'VIEW_REPORTS', parameters: {}, confidence: 0.95 };
  }

  // 24. Disputes
  if (/dispute|disputes|complaint|complaints|issue|issues|claim|claims|विवाद|शिकायत|ವಿವಾದಗಳು|ವಿವಾದ|சர்ச்சைகள்|వివాదాలు/i.test(lower)) {
    return { intent: 'VIEW_DISPUTES', parameters: {}, confidence: 0.95 };
  }

  // 25. Support & Help
  if (/support|help|help center|customer care|contact us|contact support|madad|madat|sahaya|udhavi|sahayam|सहायता|मदद|ಸಹಾಯ|உதவி|సహాయం/i.test(lower)) {
    return { intent: 'VIEW_SUPPORT', parameters: {}, confidence: 0.95 };
  }

  // 26. Add Employee
  if (/add employee|new employee|register employee|add staff|कर्मचारी जोड़ें/i.test(lower)) {
    return { intent: 'ADD_EMPLOYEE', parameters: {}, confidence: 0.95 };
  }

  // 27. Employees
  if (/employee|employees|staff|team|workers|colleagues|कर्मचारी|ಉದ್ಯೋಗಿಗಳು|ஊழியர்கள்|ఉద్యోగులు/i.test(lower)) {
    return { intent: 'VIEW_EMPLOYEES', parameters: {}, confidence: 0.95 };
  }

  // 28. Marketplace
  if (/marketplace|market|mandi|bazaar|मार्केट|मंडी|बाजार|ಮಾರುಕಟ್ಟೆ|சந்தை|మార్కెట్/i.test(lower)) {
    return { intent: 'VIEW_MARKETPLACE', parameters: {}, confidence: 0.95 };
  }

  // 29. About
  if (/about|about app|app info|version|के बारे में|ಬಗ್ಗೆ|பற்றி|గురించి/i.test(lower)) {
    return { intent: 'VIEW_ABOUT', parameters: {}, confidence: 0.95 };
  }

  // 30. AI Voice Chat
  if (/voice chat|ai chat|agri ai|assistant|ai assistant|talk to ai|एआई|ಎಐ/i.test(lower)) {
    return { intent: 'VIEW_VOICE_CHAT', parameters: {}, confidence: 0.95 };
  }

  // 31. Dashboard / Home / Operations
  if (/dashboard|operation|operations|overview|home|main screen|summary|डैशबोर्ड|होम|ಮುಖ್ಯಪುಟ|ಡ್ಯಾಶ್‌ಬೋರ್ಡ್|முகப்பு/i.test(lower)) {
    return { intent: 'VIEW_DASHBOARD', parameters: {}, confidence: 0.95 };
  }

  // 32. Greetings & Help
  if (/^(hello|hi|hey|namaste|vanakkam|namaskara|namaskaram|help|what can you do|नमस्ते|வணக்கம்|ನಮಸ್ಕಾರ)/i.test(lower)) {
    return { intent: 'VIEW_VOICE_CHAT', parameters: {}, confidence: 0.95 };
  }

  return { intent: 'UNKNOWN', parameters: {}, confidence: 0.3 };
}

class LLMVoiceIntentService implements NLPProvider {
  async analyzeIntent(text: string, languageCode: string): Promise<VoiceIntent> {
    const apiKey = process.env.EXPO_PUBLIC_NLP_API_KEY;
    
    // Fall back to rule-based intent recognition if no external NLP key is provided
    if (!apiKey) {
      return matchLocalIntent(text);
    }

    try {
      // Using OpenAI Chat Completions API as an example
      const systemPrompt = `
You are an intent recognition engine for AgriAgent, an agricultural marketplace app.
Analyze the user's input and extract the intent and parameters.
Language Code: ${languageCode}

Available Intents:
- VIEW_NOTIFICATIONS: Open notifications / alerts
- VIEW_LIVE_TRACKING: Show live tracking map / in-transit / GPS
- VIEW_PROFILE: Open agent profile / account
- EDIT_PROFILE: Edit profile
- VIEW_SECURITY: Open security / password settings
- VIEW_DASHBOARD: Open operations overview / dashboard
- VIEW_ORDERS: Show orders list
- CREATE_ORDER: Create a new order
- CANCEL_ORDER: Cancel an order
- VIEW_DELIVERIES: Show deliveries / dispatches
- ADD_DELIVERY: Create / assign new delivery
- VIEW_DELIVERY_PARTNERS: Show delivery partners / drivers
- VIEW_FLEET: Show vehicles / fleet
- VIEW_FARMERS: Show farmers directory
- ADD_FARMER: Add a new farmer
- VIEW_BUYERS: Show buyers list
- ADD_BUYER: Add a new buyer
- VIEW_PRODUCTS: Show products / inventory / stock
- ADD_PRODUCT: Add a new product / crop
- VIEW_PAYMENTS: Show payments / transactions
- VIEW_SETTLEMENTS: Show farmer settlements
- VIEW_EARNINGS: Show earnings and commissions
- VIEW_REPORTS: Show reports / analytics / KPIs
- VIEW_SETTINGS: Open settings
- CHANGE_LANGUAGE: Change language
- VIEW_DISPUTES: Show disputes
- VIEW_SUPPORT: Open support / help center
- VIEW_EMPLOYEES: Show employees / staff
- ADD_EMPLOYEE: Add new employee
- VIEW_MARKETPLACE: Open marketplace
- VIEW_ABOUT: Show about app
- VIEW_VOICE_CHAT: Open Agri AI chat

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
        return matchLocalIntent(text);
      }

      const result = await response.json();
      const content = result.choices[0]?.message?.content;
      
      try {
        const parsed = JSON.parse(content);
        return {
          intent: parsed.intent || 'UNKNOWN',
          parameters: parsed.parameters || {},
          confidence: parsed.confidence || 0
        };
      } catch (parseError) {
        return matchLocalIntent(text);
      }

    } catch (error) {
      console.warn('NLP API call failed, falling back to local intent parser:', error);
      return matchLocalIntent(text);
    }
  }
}

export const intentService = new LLMVoiceIntentService();
