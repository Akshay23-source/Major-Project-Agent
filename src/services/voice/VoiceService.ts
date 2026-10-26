import { sttService } from './SpeechRecognitionService';
import { ttsService } from './TextToSpeechService';
import { intentService } from './VoiceIntentService';
import { VoiceIntent } from './VoiceProvider';
import { router } from 'expo-router';
import { setLanguage as setI18nLanguage } from '../localization/i18n';

export type VoiceState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR' | 'CONFIRMING';

export interface VoiceServiceOptions {
  languageCode: string;
  onStateChange?: (state: VoiceState) => void;
  onTranscriptUpdate?: (text: string) => void;
  onAssistantResponse?: (text: string) => void;
  onActionRequired?: (intent: VoiceIntent) => void;
  onError?: (error: string) => void;
}

const REPEAT_MESSAGES: Record<string, string> = {
  en: "Sorry, I couldn't understand that clearly. Can you please repeat?",
  hi: "माफ़ कीजिए, मैं समझ नहीं पाया। कृपया दोबारा बोलें।",
  kn: "ಕ್ಷಮಿಸಿ, ಸ್ಪಷ್ಟವಾಗಿ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ.",
  ta: "மன்னிக்கவும், சரியாகப் புரியவில்லை. தயவுசெய்து மீண்டும் சொல்லுங்கள்.",
  te: "క్షమించండి, స్పష్టంగా అర్థం కాలేదు. దయచేసి మళ్లీ చెప్పండి.",
  mr: "क्षमस्व, मला स्पष्ट समजले नाही. कृपया पुन्हा सांगा.",
  gu: "માફ કરશો, સ્પષ્ટ સમજાયું નહીં. કૃપા કરીને ફરીથી કહો.",
  bn: "দুঃখিত, স্পষ্টভাবে বুঝতে পারিনি। অনুগ্রহ করে আবার বলুন।",
  pa: "ਮਾਫ਼ ਕਰਨਾ, ਸਪਸ਼ਟ ਸਮਝ ਨਹੀਂ ਆਇਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਬੋਲੋ।",
  ml: "ക്ഷമിക്കണം, വ്യക്തമായി മനസ്സിലായില്ല. ദയവായി വീണ്ടും പറയുക.",
};

const LOCALIZED_RESPONSES: Record<string, Record<string, string>> = {
  VIEW_NOTIFICATIONS: {
    en: 'Opening notifications',
    hi: 'सूचनाएं खोल रहे हैं',
    kn: 'ಅಧಿಸೂಚನೆಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'அறிவிப்புகள் திறக்கப்படுகின்றன',
    te: 'నోటిఫికేషన్లు తెరుస్తోంది',
    mr: 'सूचना उघडत आहे',
    gu: 'સૂચનાઓ ખોલી રહ્યું છે',
    bn: 'বিজ্ঞপ্তি খোলা হচ্ছে',
  },
  VIEW_LIVE_TRACKING: {
    en: 'Opening live tracking map',
    hi: 'लाइव ट्रैकिंग मैप खोल रहे हैं',
    kn: 'ಲೈವ್ ಟ್ರ್ಯಾಕಿಂಗ್ ನಕ್ಷೆಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'நேரலை கண்காணிப்பு வரைபடம் திறக்கப்படுகிறது',
    te: 'లైవ్ ట్రాకింగ్ మ్యాప్ తెరుస్తోంది',
    mr: 'थेट ट्रॅकिंग नकाशा उघडत आहे',
    gu: 'લાઇવ ટ્રેકિંગ નકશો ખોલી રહ્યું છે',
    bn: 'লাইভ ট্র্যাকিং ম্যাপ খোলা হচ্ছে',
  },
  VIEW_PROFILE: {
    en: 'Opening profile',
    hi: 'प्रोफ़ाइल खोल रहे हैं',
    kn: 'ಪ್ರೊಫೈಲ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'சுயவிவரம் திறக்கப்படுகிறது',
    te: 'ప్రొఫైల్ తెరుస్తోంది',
    mr: 'प्रोफाइल उघडत आहे',
    gu: 'પ્રોફાઇલ ખોલી રહ્યું છે',
    bn: 'প্রোফাইল খোলা হচ্ছে',
  },
  EDIT_PROFILE: {
    en: 'Opening edit profile',
    hi: 'प्रोफ़ाइल संपादन खोल रहे हैं',
    kn: 'ಪ್ರೊಫೈಲ್ ಸಂಪಾದನೆಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'சுயவிவரம் திருத்துதல் திறக்கப்படுகிறது',
    te: 'ప్రొఫైల్ సవరణ తెరుస్తోంది',
  },
  VIEW_SECURITY: {
    en: 'Opening security settings',
    hi: 'सुरक्षा सेटिंग्स खोल रहे हैं',
    kn: 'ಭದ್ರತಾ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'பாதுகாப்பு அமைப்புகள் திறக்கப்படுகின்றன',
    te: 'భద్రతా సెట్టింగులు తెరుస్తోంది',
  },
  VIEW_DASHBOARD: {
    en: 'Opening operations dashboard',
    hi: 'डैशबोर्ड खोल रहे हैं',
    kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'டாஷ்போர்டு திறக்கப்படுகிறது',
    te: 'డాష్‌బోర్డ్ తెరుస్తోంది',
    mr: 'डॅशबोर्ड उघडत आहे',
    gu: 'ડેશબોર્ડ ખોલી રહ્યું છે',
    bn: 'ড্যাশবোর্ড খোলা হচ্ছে',
  },
  VIEW_ORDERS: {
    en: 'Opening orders',
    hi: 'ऑर्डर सूची खोल रहे हैं',
    kn: 'ಆರ್ಡರ್‌ಗಳ ಪಟ್ಟಿಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'ஆர்டர்கள் திறக்கப்படுகின்றன',
    te: 'ఆర్డర్లు తెరుస్తోంది',
    mr: 'ऑर्डर्स उघडत आहे',
    gu: 'ઓર્ડર ખોલી રહ્યું છે',
    bn: 'অর্ডার খোলা হচ্ছে',
  },
  CREATE_ORDER: {
    en: 'Opening new order screen',
    hi: 'नया ऑर्डर फॉर्म खोल रहे हैं',
    kn: 'ಹೊಸ ಆರ್ಡರ್ ಫಾರ್ಮ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'புதிய ஆர்டர் படிவம் திறக்கப்படுகிறது',
    te: 'కొత్త ఆర్డర్ స్క్రీన్ తెరుస్తోంది',
  },
  CANCEL_ORDER: {
    en: 'Opening orders to cancel an order',
    hi: 'ऑर्डर रद्द करने के लिए सूची खोल रहे हैं',
    kn: 'ಆರ್ಡರ್ ರದ್ದುಗೊಳಿಸಲು ಪಟ್ಟಿಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'ஆர்டரை ரத்து செய்ய திறக்கப்படுகிறது',
    te: 'ఆర్డర్ రద్దు కోసం తెరుస్తోంది',
  },
  VIEW_DELIVERIES: {
    en: 'Opening deliveries',
    hi: 'डिलीवरी सूची खोल रहे हैं',
    kn: 'ವಿತರಣೆಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'டெலிவரிகள் திறக்கப்படுகின்றன',
    te: 'డెలివరీలు తెరుస్తోంది',
  },
  ADD_DELIVERY: {
    en: 'Opening add delivery screen',
    hi: 'नई डिलीवरी फॉर्म खोल रहे हैं',
    kn: 'ಹೊಸ ವಿತರಣೆ ಸೇರಿಸುವ ಫಾರ್ಮ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'புதிய டெலிவரி படிவம் திறக்கப்படுகிறது',
    te: 'కొత్త డెలివరీ స్క్రీన్ తెరుస్తోంది',
  },
  VIEW_DELIVERY_PARTNERS: {
    en: 'Opening delivery partners',
    hi: 'ड्राइवर सूची खोल रहे हैं',
    kn: 'ಚಾಲಕರ ಪಟ್ಟಿಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'ஓட்டுநர் பட்டியல் திறக்கப்படுகிறது',
    te: 'డ్రైవర్ల జాబితా తెరుస్తోంది',
  },
  VIEW_FLEET: {
    en: 'Opening vehicle fleet',
    hi: 'वाहन सूची खोल रहे हैं',
    kn: 'ವಾಹನಗಳ ಪಟ್ಟಿಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'வாகனங்கள் திறக்கப்படுகின்றன',
    te: 'వాಹనాల జాబితా తెరుస్తోంది',
  },
  VIEW_FARMERS: {
    en: 'Opening farmers directory',
    hi: 'किसान सूची खोल रहे हैं',
    kn: 'ರೈತರ ಪಟ್ಟಿಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'விவசாயிகள் பட்டியல் திறக்கப்படுகிறது',
    te: 'రైతుల జాబితా తెరుస్తోంది',
    mr: 'शेतकरी यादी उघडत आहे',
    gu: 'ખેડૂતોની યાદી ખોલી રહ્યું છે',
    bn: 'কৃষকদের তালিকা খোলা হচ্ছে',
  },
  ADD_FARMER: {
    en: 'Opening add farmer form',
    hi: 'किसान जोड़ने का फॉर्म खोल रहे हैं',
    kn: 'ರೈತರನ್ನು ಸೇರಿಸುವ ಫಾರ್ಮ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'விவசாயி சேர்க்கும் படிவம் திறக்கப்படுகிறது',
    te: 'రైతును జోడించే ఫారమ్ తెరుస్తోంది',
  },
  VIEW_BUYERS: {
    en: 'Opening buyers list',
    hi: 'खरीदार सूची खोल रहे हैं',
    kn: 'ಖರೀದಿದಾರರ ಪಟ್ಟಿಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'வாங்குபவர்கள் பட்டியல் திறக்கப்படுகிறது',
    te: 'కొనుగోలుదారుల జాబితా తెరుస్తోంది',
  },
  ADD_BUYER: {
    en: 'Opening add buyer form',
    hi: 'खरीदार जोड़ने का फॉर्म खोल रहे हैं',
    kn: 'ಖರೀದಿದಾರರನ್ನು ಸೇರಿಸುವ ಫಾರ್ಮ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'வாங்குபவர் சேர்க்கும் படிவம் திறக்கப்படுகிறது',
    te: 'కొనుగోలుదారుని జోడించే ఫారమ్ తెరుస్తోంది',
  },
  VIEW_PRODUCTS: {
    en: 'Opening products and inventory',
    hi: 'उत्पाद और इन्वेंटरी खोल रहे हैं',
    kn: 'ಉತ್ಪನ್ನಗಳು ಮತ್ತು ದಾಸ್ತಾನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'பொருட்கள் மற்றும் இருப்பு திறக்கப்படுகிறது',
    te: 'ఉత్పత్తులు మరియు నిల్వ తెరుస్తోంది',
  },
  VIEW_LOW_STOCK: {
    en: 'Checking low stock inventory',
    hi: 'कम स्टॉक सूची की जांच कर रहे हैं',
    kn: 'ಕಡಿಮೆ ದಾಸ್ತಾನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ',
    ta: 'குறைந்த இருப்பு சரிபார்க்கப்படுகிறது',
    te: 'తక్కువ నిల్వను తనిఖీ చేస్తోంది',
  },
  ADD_PRODUCT: {
    en: 'Opening add product form',
    hi: 'उत्पाद जोड़ने का फॉर्म खोल रहे हैं',
    kn: 'ಉತ್ಪನ್ನ ಸೇರಿಸುವ ಫಾರ್ಮ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'பொருள் சேர்க்கும் படிவம் திறக்கப்படுகிறது',
    te: 'ఉత్పత్తిని జోడించే ఫారమ్ తెరుస్తోంది',
  },
  VIEW_PAYMENTS: {
    en: 'Opening payments',
    hi: 'भुगतान सूची खोल रहे हैं',
    kn: 'ಪಾವತಿಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'கொடுப்பனவுகள் திறக்கப்படுகின்றன',
    te: 'చెల్లింపులు తెరుస్తోంది',
  },
  VIEW_SETTLEMENTS: {
    en: 'Opening farmer settlements',
    hi: 'किसान निपटान खोल रहे हैं',
    kn: 'ರೈತರ ಇತ್ಯರ್ಥಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'விவசாயிகள் செட்டில்மெண்ட் திறக்கப்படுகிறது',
    te: 'రైతుల సెటిల్‌మెంట్లు తెరుస్తోంది',
  },
  VIEW_EARNINGS: {
    en: 'Opening earnings and commissions',
    hi: 'कमाई और कमीशन खोल रहे हैं',
    kn: 'ಗಳಿಕೆ ಮತ್ತು ಕಮಿಷನ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'வருவாய் மற்றும் கமிஷன் திறக்கப்படுகிறது',
    te: 'ఆదాయం మరియు కమీషన్ తెరుస్తోంది',
  },
  VIEW_REPORTS: {
    en: 'Opening reports and analytics',
    hi: 'रिपोर्ट और विश्लेषण खोल रहे हैं',
    kn: 'ವರದಿಗಳು ಮತ್ತು ವಿಶ್ಲೇಷಣೆ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'அறிக்கைகள் திறக்கப்படுகின்றன',
    te: 'నివేదికలు తెరుస్తోంది',
  },
  VIEW_SETTINGS: {
    en: 'Opening settings',
    hi: 'सेटिंग्स खोल रहे हैं',
    kn: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'அமைப்புகள் திறக்கப்படுகின்றன',
    te: 'సెట్టింగులు తెరుస్తోంది',
  },
  CHANGE_LANGUAGE: {
    en: 'Opening settings for language selection',
    hi: 'भाषा चयन सेटिंग्स खोल रहे हैं',
    kn: 'ಭಾಷೆ ಆಯ್ಕೆಯ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'மொழி தேர்வு அமைப்புகள் திறக்கப்படுகின்றன',
    te: 'భాష ఎంపిక సెట్టింగులు తెరుస్తోంది',
  },
  VIEW_DISPUTES: {
    en: 'Opening disputes',
    hi: 'विवाद सूची खोल रहे हैं',
    kn: 'ವಿವಾದಗಳ ಪಟ್ಟಿಯನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'சர்ச்சைகள் திறக்கப்படுகின்றன',
    te: 'వివాదాలు తెరుస్తోంది',
  },
  VIEW_SUPPORT: {
    en: 'Opening support center',
    hi: 'सहायता केंद्र खोल रहे हैं',
    kn: 'ಸಹಾಯ ಕೇಂದ್ರವನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'உதவி மையம் திறக்கப்படுகிறது',
    te: 'సಹాయ కేంద్రం తెరుస్తోంది',
  },
  VIEW_EMPLOYEES: {
    en: 'Opening employee management',
    hi: 'कर्मचारी प्रबंधन खोल रहे हैं',
    kn: 'ಉದ್ಯೋಗಿ ನಿರ್ವಹಣೆ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'ஊழியர் மேலாண்மை திறக்கப்படுகிறது',
    te: 'ఉద్యోగుల నిర్వహణ తెరుస్తోంది',
  },
  ADD_EMPLOYEE: {
    en: 'Opening add employee form',
    hi: 'कर्मचारी जोड़ने का फॉर्म खोल रहे हैं',
    kn: 'ಉದ್ಯೋಗಿ ಸೇರಿಸುವ ಫಾರ್ಮ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'ஊழியர் சேர்க்கும் படிவம் திறக்கப்படுகிறது',
    te: 'ఉద్యోగిని జోడించే ఫారమ్ తెరుస్తోంది',
  },
  VIEW_MARKETPLACE: {
    en: 'Opening marketplace',
    hi: 'मार्केटप्लेस खोल रहे हैं',
    kn: 'ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್ ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'சந்தை திறக்கப்படுகிறது',
    te: 'మార్కెట్‌ప్లేస్ తెరుస్తోంది',
  },
  VIEW_ABOUT: {
    en: 'Opening about Agri Agent',
    hi: 'एग्री एजेंट के बारे में',
    kn: 'ಅಗ್ರಿ ಏಜೆಂಟ್ ಬಗ್ಗೆ',
    ta: 'அக்ரி ஏஜென்ட் பற்றி',
    te: 'அగ్రి ఏజెంట్ గురించి',
  },
  VIEW_VOICE_CHAT: {
    en: 'Opening Agri AI assistant',
    hi: 'एग्री एआई सहायक खोल रहे हैं',
    kn: 'ಅಗ್ರಿ ಎಐ ಸಹಾಯಕವನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ',
    ta: 'அக்ரி AI உதவியாளர் திறக்கப்படுகிறது',
    te: 'అగ్రి AI సహాయకుడు తెరుస్తోంది',
  }
};

class VoiceService {
  private state: VoiceState = 'IDLE';
  private options?: VoiceServiceOptions;
  
  init(options: VoiceServiceOptions) {
    this.options = options;
  }

  private setState(state: VoiceState) {
    this.state = state;
    if (this.options?.onStateChange) {
      this.options.onStateChange(state);
    }
  }

  async startInteraction() {
    try {
      if (!this.options) throw new Error('VoiceService not initialized');
      this.setState('LISTENING');
      await sttService.startListening(this.options.languageCode, (text) => {
        if (this.options?.onTranscriptUpdate) this.options.onTranscriptUpdate(text);
      });
    } catch (error: any) {
      this.setState('ERROR');
      if (this.options?.onError) this.options.onError(error.message);
    }
  }

  async stopListeningAndProcess() {
    try {
      if (!this.options) return;
      this.setState('THINKING');
      
      const transcript = await sttService.stopListening();
      if (this.options?.onTranscriptUpdate) this.options.onTranscriptUpdate(transcript);

      if (!transcript || transcript.trim() === '') {
        this.setState('IDLE');
        return;
      }

      const intent = await intentService.analyzeIntent(transcript, this.options.languageCode);
      
      if (intent.confidence < 0.6) {
        // Low confidence, ask to repeat in user's detected / current language
        const detected = (sttService as any).getLastDetectedLanguage?.();
        const detectedLang = detected ? detected.split('-')[0].toLowerCase() : null;
        const currentLang = this.options.languageCode?.split('-')[0] || 'en';
        const activeLang = (detectedLang && detectedLang !== 'en') ? detectedLang : currentLang;
        const msg = REPEAT_MESSAGES[activeLang] || REPEAT_MESSAGES.en;
        await this.speakResponse(msg, activeLang);
        return;
      }

      if (this.isDestructiveAction(intent.intent)) {
        this.setState('CONFIRMING');
        if (this.options?.onActionRequired) this.options.onActionRequired(intent);
        return;
      }

      // Execute read actions immediately
      await this.executeAction(intent);

    } catch (error: any) {
      this.setState('ERROR');
      if (this.options?.onError) this.options.onError(error.message);
    }
  }

  private isDestructiveAction(intent: string): boolean {
    const destructiveIntents = ['CANCEL_ORDER', 'DELETE_FARMER', 'ADD_FARMER'];
    return destructiveIntents.includes(intent);
  }

  async executeAction(intent: VoiceIntent) {
    if (!this.options) return;
    
    console.log('Executing Intent:', intent);
    
    let responseText = `Executed ${intent.intent}`;
    let targetRoute = '';

    switch (intent.intent) {
      case 'CHANGE_LANGUAGE_TO': {
        const lang = intent.parameters?.lang || 'en';
        await setI18nLanguage(lang);
        if (this.options) this.options.languageCode = lang;
        const langNames: Record<string, string> = {
          hi: 'हिन्दी', kn: 'ಕನ್ನಡ', ta: 'தமிழ்', te: 'తెలుగు',
          mr: 'मराठी', gu: 'ગુજરાતી', bn: 'বাংলা', pa: 'ਪੰਜਾਬੀ',
          ml: 'മലയാളം', or: 'ଓଡ଼ିଆ', en: 'English'
        };
        const langName = langNames[lang] || lang;
        if (lang === 'kn') responseText = `${langName} ಭಾಷೆಗೆ ಬದಲಾಯಿಸಲಾಗಿದೆ`;
        else if (lang === 'hi') responseText = `${langName} भाषा में बदला गया`;
        else if (lang === 'ta') responseText = `${langName} மொழிக்கு மாற்றப்பட்டது`;
        else if (lang === 'te') responseText = `${langName} భాషకు మార్చబడింది`;
        else if (lang === 'mr') responseText = `${langName} भाषेत बदलले आहे`;
        else if (lang === 'gu') responseText = `${langName} ભાષામાં બદલાયેલ છે`;
        else if (lang === 'bn') responseText = `${langName} ভাষায় পরিবর্তিত হয়েছে`;
        else if (lang === 'pa') responseText = `${langName} ਭਾਸ਼ਾ ਵਿੱਚ ਬਦਲਿਆ ਗਿਆ`;
        else if (lang === 'ml') responseText = `${langName} ഭാഷയിലേക്ക് മാറ്റി`;
        else responseText = `Language changed to ${langName}`;
        break;
      }
      case 'VIEW_NOTIFICATIONS':
        responseText = 'Opening notifications';
        targetRoute = '/(agent)/notifications';
        break;
      case 'VIEW_LIVE_TRACKING':
        responseText = 'Opening live tracking map';
        targetRoute = '/(agent)/logistics/map';
        break;
      case 'VIEW_PROFILE':
        responseText = 'Opening profile';
        targetRoute = '/(agent)/profile';
        break;
      case 'EDIT_PROFILE':
        responseText = 'Opening edit profile';
        targetRoute = '/(agent)/edit-profile';
        break;
      case 'VIEW_SECURITY':
        responseText = 'Opening security settings';
        targetRoute = '/(agent)/settings/security';
        break;
      case 'VIEW_DASHBOARD':
        responseText = 'Opening operations dashboard';
        targetRoute = '/(agent)/dashboard';
        break;
      case 'VIEW_ORDERS':
        responseText = 'Opening orders';
        targetRoute = '/(agent)/orders';
        break;
      case 'CREATE_ORDER':
        responseText = 'Opening new order screen';
        targetRoute = '/(agent)/orders/create';
        break;
      case 'CANCEL_ORDER':
        responseText = 'Opening orders to cancel an order';
        targetRoute = '/(agent)/orders';
        break;
      case 'VIEW_DELIVERIES':
        responseText = 'Opening deliveries';
        targetRoute = '/(agent)/deliveries';
        break;
      case 'ADD_DELIVERY':
        responseText = 'Opening add delivery screen';
        targetRoute = '/(agent)/deliveries/add';
        break;
      case 'VIEW_DELIVERY_PARTNERS':
        responseText = 'Opening delivery partners';
        targetRoute = '/(agent)/delivery-partners';
        break;
      case 'VIEW_FLEET':
        responseText = 'Opening vehicle fleet';
        targetRoute = '/(agent)/fleet';
        break;
      case 'VIEW_FARMERS':
        responseText = 'Opening farmers directory';
        targetRoute = '/(agent)/farmers';
        break;
      case 'ADD_FARMER':
        responseText = 'Opening add farmer form';
        targetRoute = '/(agent)/add-farmer';
        break;
      case 'VIEW_BUYERS':
        responseText = 'Opening buyers list';
        targetRoute = '/(agent)/buyers';
        break;
      case 'ADD_BUYER':
        responseText = 'Opening add buyer form';
        targetRoute = '/(agent)/buyers/add';
        break;
      case 'VIEW_PRODUCTS':
      case 'VIEW_LOW_STOCK':
        responseText = 'Opening products and inventory';
        targetRoute = '/(agent)/products';
        break;
      case 'ADD_PRODUCT':
        responseText = 'Opening add product form';
        targetRoute = '/(agent)/products/add';
        break;
      case 'VIEW_PAYMENTS':
        responseText = 'Opening payments';
        targetRoute = '/(agent)/payments';
        break;
      case 'VIEW_SETTLEMENTS':
        responseText = 'Opening farmer settlements';
        targetRoute = '/(agent)/payments/settlements';
        break;
      case 'VIEW_EARNINGS':
        responseText = 'Opening earnings and commissions';
        targetRoute = '/(agent)/earnings';
        break;
      case 'VIEW_REPORTS':
        responseText = 'Opening reports and analytics';
        targetRoute = '/(agent)/reports';
        break;
      case 'VIEW_SETTINGS':
        responseText = 'Opening settings';
        targetRoute = '/(agent)/settings';
        break;
      case 'CHANGE_LANGUAGE':
        responseText = 'Opening settings for language selection';
        targetRoute = '/(agent)/settings';
        break;
      case 'VIEW_DISPUTES':
        responseText = 'Opening disputes';
        targetRoute = '/(agent)/disputes';
        break;
      case 'VIEW_SUPPORT':
        responseText = 'Opening support center';
        targetRoute = '/(agent)/support';
        break;
      case 'VIEW_EMPLOYEES':
        responseText = 'Opening employee management';
        targetRoute = '/(agent)/employees';
        break;
      case 'ADD_EMPLOYEE':
        responseText = 'Opening add employee form';
        targetRoute = '/(agent)/employees/add';
        break;
      case 'VIEW_MARKETPLACE':
        responseText = 'Opening marketplace';
        targetRoute = '/(agent)/marketplace';
        break;
      case 'VIEW_ABOUT':
        responseText = 'Opening about Agri Agent';
        targetRoute = '/(agent)/about';
        break;
      case 'VIEW_VOICE_CHAT':
        responseText = 'Opening Agri AI assistant';
        targetRoute = '/(agent)/voice';
        break;
      default:
        responseText = `Recognized ${intent.intent.replace(/_/g, ' ').toLowerCase()}`;
    }

    if (targetRoute) {
      try {
        router.push(targetRoute as any);
      } catch (err) {
        console.warn('Router push failed:', err);
      }
    }

    const detected = (sttService as any).getLastDetectedLanguage?.();
    const detectedLang = detected ? detected.split('-')[0].toLowerCase() : null;
    const currentLang = this.options.languageCode?.split('-')[0] || 'en';
    const activeLang = (detectedLang && detectedLang !== 'en') ? detectedLang : currentLang;

    // If an Indian language was spoken, ensure app is synchronized to this locale
    if (detectedLang && detectedLang !== 'en' && detectedLang !== currentLang) {
      setI18nLanguage(detectedLang);
      if (this.options) this.options.languageCode = detectedLang;
    }

    const localized = LOCALIZED_RESPONSES[intent.intent]?.[activeLang] || LOCALIZED_RESPONSES[intent.intent]?.['en'];
    if (localized && intent.intent !== 'CHANGE_LANGUAGE_TO') {
      responseText = localized;
    }

    if (this.options.onAssistantResponse) {
      this.options.onAssistantResponse(responseText);
    }
    
    await this.speakResponse(responseText, activeLang);
  }

  async speakResponse(text: string, langCode?: string) {
    if (!this.options) return;
    this.setState('SPEAKING');
    try {
      const language = langCode || this.options.languageCode || 'en';
      await ttsService.speak(text, language, () => {
        this.setState('IDLE');
      });
    } catch (error) {
       this.setState('ERROR');
    }
  }

  async cancel() {
    await sttService.cancelListening();
    await ttsService.stop();
    this.setState('IDLE');
  }
}

export const voiceService = new VoiceService();
