export type VoiceGender = "male" | "female";

export const FEMALE_NARRATOR_NAME = "Advocate Aditi Mehra";
export const MALE_NARRATOR_NAME = "Advocate KD Pathak";

const REMOTION_VOICE_LANGUAGES = [
  "English",
  "Hindi",
  "Marathi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Bengali",
  "Gujarati",
  "Malayalam",
  "Punjabi",
] as const;

type AvatarTemplateBuilder = (speakerName: string, gender: VoiceGender) => string;

const AVATAR_TEMPLATE_BUILDERS: Record<string, AvatarTemplateBuilder> = {
  English: (speakerName) =>
    `Hello {{ customer_name }}. This is ${speakerName} speaking on behalf of {{ client_name }} regarding your {{ product_type }} account {{ lan }}. Our records show an outstanding balance of {{ tos }}{% if loan_amt %} against an original amount of {{ loan_amt }}{% endif %}. Please treat this legal notice seriously and contact us immediately at {{ contact_details }} to discuss payment. A timely response may help avoid further legal escalation.`,
  Hindi: (speakerName, gender) =>
    `नमस्ते {{ customer_name }}। मैं ${speakerName} ${gender === "male" ? "बोल रहा हूँ" : "बोल रही हूँ"}, आपके {{ client_name }} के साथ {{ product_type }} अकाउंट नंबर {{ lan }} के संबंध में। हमारी जानकारी के अनुसार आपकी कुल बकाया राशि {{ tos }} है{% if loan_amt %} और मूल लोन राशि {{ loan_amt }} थी{% endif %}। कृपया इस कानूनी सूचना को गंभीरता से लें और भुगतान पर चर्चा के लिए तुरंत {{ contact_details }} पर संपर्क करें। समय पर प्रतिक्रिया देने से आगे की कानूनी कार्रवाई से बचने में मदद मिल सकती है।`,
  Marathi: (speakerName) =>
    `नमस्कार {{ customer_name }}. मी ${speakerName} बोलत आहे, {{ client_name }} कडून तुमच्या {{ product_type }} खाते क्रमांक {{ lan }} संदर्भात. आमच्या नोंदीनुसार तुमची एकूण थकबाकी {{ tos }} आहे{% if loan_amt %} आणि मूळ कर्जरक्कम {{ loan_amt }} होती{% endif %}. कृपया या कायदेशीर सूचनेला गांभीर्याने घ्या आणि पेमेंटबाबत चर्चा करण्यासाठी त्वरित {{ contact_details }} वर संपर्क साधा. वेळेत प्रतिसाद दिल्यास पुढील कायदेशीर कारवाई टाळता येऊ शकते.`,
  Tamil: (speakerName) =>
    `வணக்கம் {{ customer_name }}. நான் ${speakerName}, {{ client_name }} சார்பில் உங்கள் {{ product_type }} கணக்கு {{ lan }} பற்றி பேசுகிறேன். எங்கள் பதிவுகளின்படி உங்கள் மொத்த நிலுவை {{ tos }} ஆகும்{% if loan_amt %} மற்றும் முதற்கட்ட தொகை {{ loan_amt }} ஆகும்{% endif %}. இந்த சட்ட அறிவிப்பை மிகவும் கவனமாக எடுத்துக்கொண்டு, கட்டணம் பற்றி பேச உடனே {{ contact_details }} எண்ணில் தொடர்புகொள்ளுங்கள். சரியான நேரத்தில் பதிலளிப்பது மேலதிக சட்ட நடவடிக்கையைத் தவிர்க்க உதவும்.`,
  Telugu: (speakerName) =>
    `నమస్కారం {{ customer_name }}. నేను ${speakerName}, {{ client_name }} తరఫున మీ {{ product_type }} ఖాతా {{ lan }} గురించి మాట్లాడుతున్నాను. మా రికార్డుల ప్రకారం మీ మొత్తం బకాయి {{ tos }} ఉంది{% if loan_amt %} మరియు మొదటి రుణ మొత్తం {{ loan_amt }}{% endif %}. దయచేసి ఈ లీగల్ నోటీసును గంభీరంగా తీసుకుని, చెల్లింపు గురించి చర్చించడానికి వెంటనే {{ contact_details }} ను సంప్రదించండి. సమయానికి స్పందిస్తే తదుపరి లీగల్ ఎస్కలేషన్‌ను నివారించవచ్చు.`,
  Kannada: (speakerName) =>
    `ನಮಸ್ಕಾರ {{ customer_name }}. ನಾನು ${speakerName}, {{ client_name }} ಪರವಾಗಿ ನಿಮ್ಮ {{ product_type }} ಖಾತೆ {{ lan }} ಕುರಿತು ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ. ನಮ್ಮ ದಾಖಲೆಗಳ ಪ್ರಕಾರ ನಿಮ್ಮ ಒಟ್ಟು ಬಾಕಿ {{ tos }} ಆಗಿದೆ{% if loan_amt %} ಮತ್ತು ಮೂಲ ಸಾಲದ ಮೊತ್ತ {{ loan_amt }} ಆಗಿತ್ತು{% endif %}. ದಯವಿಟ್ಟು ಈ ಕಾನೂನು ಸೂಚನೆಯನ್ನು ಗಂಭೀರವಾಗಿ ಪರಿಗಣಿಸಿ ಮತ್ತು ಪಾವತಿ ಕುರಿತು ಚರ್ಚಿಸಲು ತಕ್ಷಣ {{ contact_details }} ಅನ್ನು ಸಂಪರ್ಕಿಸಿ. ಸಮಯಕ್ಕೆ ಪ್ರತಿಕ್ರಿಯಿಸಿದರೆ ಮುಂದಿನ ಕಾನೂನು ಕ್ರಮವನ್ನು ತಪ್ಪಿಸಬಹುದು.`,
  Bengali: (speakerName) =>
    `নমস্কার {{ customer_name }}। আমি ${speakerName}, {{ client_name }}-এর পক্ষ থেকে আপনার {{ product_type }} অ্যাকাউন্ট {{ lan }} সম্পর্কে কথা বলছি। আমাদের নথি অনুযায়ী আপনার মোট বকেয়া {{ tos }}{% if loan_amt %} এবং মূল ঋণের পরিমাণ ছিল {{ loan_amt }}{% endif %}। অনুগ্রহ করে এই আইনি নোটিশটিকে গুরুত্ব সহকারে নিন এবং অর্থপ্রদান নিয়ে আলোচনা করতে অবিলম্বে {{ contact_details }} নম্বরে যোগাযোগ করুন। সময়মতো সাড়া দিলে অতিরিক্ত আইনি পদক্ষেপ এড়ানো যেতে পারে।`,
  Gujarati: (speakerName) =>
    `નમસ્તે {{ customer_name }}. હું ${speakerName}, {{ client_name }} તરફથી તમારા {{ product_type }} ખાતા {{ lan }} વિશે વાત કરી રહ્યો છું. અમારી નોંધ મુજબ તમારી કુલ બાકી રકમ {{ tos }} છે{% if loan_amt %} અને મૂળ લોન રકમ {{ loan_amt }} હતી{% endif %}. કૃપા કરીને આ કાનૂની સૂચનાને ગંભીરતાથી લો અને ચુકવણી અંગે ચર્ચા કરવા માટે તરત જ {{ contact_details }} પર સંપર્ક કરો. સમયસર પ્રતિસાદ આપવાથી આગળની કાનૂની કાર્યવાહી ટાળી શકાય છે.`,
  Malayalam: (speakerName) =>
    `നമസ്കാരം {{ customer_name }}. ഞാൻ ${speakerName}, {{ client_name }}യുടെ ഭാഗത്തുനിന്ന് നിങ്ങളുടെ {{ product_type }} അക്കൗണ്ട് {{ lan }} സംബന്ധിച്ച് സംസാരിക്കുകയാണ്. ഞങ്ങളുടെ രേഖപ്രകാരം നിങ്ങളുടെ മൊത്തം കുടിശ്ശിക {{ tos }} ആണ്{% if loan_amt %} കൂടാതെ ആദ്യ വായ്പാ തുക {{ loan_amt }} ആയിരുന്നു{% endif %}. ദയവായി ഈ നിയമപരമായ നോട്ടീസ് ഗൗരവമായി കാണുകയും അടവ് സംബന്ധിച്ച് സംസാരിക്കാൻ ഉടൻ {{ contact_details }} എന്ന നമ്പറിൽ ബന്ധപ്പെടുകയും ചെയ്യുക. സമയബന്ധിതമായ പ്രതികരണം കൂടുതൽ നിയമനടപടി ഒഴിവാക്കാൻ സഹായിക്കും.`,
  Punjabi: (speakerName) =>
    `ਨਮਸਤੇ {{ customer_name }}। ਮੈਂ ${speakerName}, {{ client_name }} ਵਲੋਂ ਤੁਹਾਡੇ {{ product_type }} ਖਾਤੇ {{ lan }} ਬਾਰੇ ਗੱਲ ਕਰ ਰਿਹਾ ਹਾਂ। ਸਾਡੇ ਰਿਕਾਰਡ ਅਨੁਸਾਰ ਤੁਹਾਡੀ ਕੁੱਲ ਬਕਾਇਆ ਰਕਮ {{ tos }} ਹੈ{% if loan_amt %} ਅਤੇ ਮੁੱਢਲੀ ਲੋਨ ਰਕਮ {{ loan_amt }} ਸੀ{% endif %}। ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਕਾਨੂੰਨੀ ਨੋਟਿਸ ਨੂੰ ਗੰਭੀਰਤਾ ਨਾਲ ਲਓ ਅਤੇ ਭੁਗਤਾਨ ਬਾਰੇ ਗੱਲ ਕਰਨ ਲਈ ਤੁਰੰਤ {{ contact_details }} 'ਤੇ ਸੰਪਰਕ ਕਰੋ। ਸਮੇਂ ਸਿਰ ਜਵਾਬ ਦੇਣ ਨਾਲ ਅੱਗੇ ਦੀ ਕਾਨੂੰਨੀ ਕਾਰਵਾਈ ਤੋਂ ਬਚਿਆ ਜਾ ਸਕਦਾ ਹੈ।`,
};

function resolveNarratorName(gender: VoiceGender): string {
  return gender === "male" ? MALE_NARRATOR_NAME : FEMALE_NARRATOR_NAME;
}

export function resolveNarratorGender(gender?: string | null): VoiceGender {
  return gender === "male" ? "male" : "female";
}

export function getDefaultAvatarScript(language: string, gender?: string | null): string {
  const resolvedLanguage = AVATAR_TEMPLATE_BUILDERS[language] ? language : "Hindi";
  const resolvedGender = resolveNarratorGender(gender);
  const speakerName = resolveNarratorName(resolvedGender);
  return AVATAR_TEMPLATE_BUILDERS[resolvedLanguage](speakerName, resolvedGender);
}

export const DEFAULT_AVATAR_SCRIPT = getDefaultAvatarScript("Hindi", "female");

export const AVATAR_TEMPLATES: Record<string, string> = Object.fromEntries(
  Object.keys(AVATAR_TEMPLATE_BUILDERS).map((language) => [language, getDefaultAvatarScript(language, "female")]),
);

export const REMOTION_TEMPLATES: Record<string, string> = {
  English: `Hello {{ customer_name }}.
I am speaking on behalf of {{ client_name }} with an important formal update regarding your {{ product_type }} account.
Our records show that the original account value was {{ loan_amount }} and your current outstanding balance is {{ tos }}.
Despite earlier reminders, the overdue amount on account {{ lan }} remains unresolved.
Please treat this communication seriously and contact us immediately at {{ contact_details }} to discuss payment or a suitable repayment arrangement.
An early response may help avoid further account escalation.
Thank you.`,
  Hindi: `नमस्ते {{ customer_name }}।
मैं {{ client_name }} की ओर से आपके {{ product_type }} खाते के संबंध में एक महत्वपूर्ण औपचारिक सूचना साझा कर रही हूँ।
हमारी जानकारी के अनुसार इस खाते की मूल राशि {{ loan_amount }} थी और वर्तमान कुल बकाया राशि {{ tos }} है।
खाता संख्या {{ lan }} पर लंबित भुगतान के बारे में पहले भी सूचित किया गया था, लेकिन स्थिति अभी तक सामान्य नहीं हुई है।
कृपया इस सूचना को गंभीरता से लें और भुगतान अथवा पुनर्भुगतान विकल्प पर चर्चा के लिए तुरंत {{ contact_details }} पर संपर्क करें।
समय पर प्रतिक्रिया देने से आगे की एस्कलेशन से बचने में मदद मिल सकती है।
धन्यवाद।`,
  Marathi: `नमस्कार {{ customer_name }}.
मी {{ client_name }} कडून तुमच्या {{ product_type }} खात्याबाबत एक महत्त्वाची औपचारिक माहिती देत आहे.
आमच्या नोंदीप्रमाणे या खात्याची मूळ रक्कम {{ loan_amount }} होती आणि सध्या एकूण थकबाकी {{ tos }} आहे.
खाते क्रमांक {{ lan }} वरील थकबाकीबद्दल यापूर्वीही कळविण्यात आले होते, तरीही स्थितीत सुधारणा झालेली नाही.
कृपया या सूचनेला गांभीर्याने घ्या आणि पेमेंट किंवा परतफेडीच्या पर्यायांबाबत त्वरित {{ contact_details }} वर संपर्क साधा.
वेळेत प्रतिसाद दिल्यास पुढील एस्कलेशन टाळता येऊ शकते.
धन्यवाद.`,
  Tamil: `வணக்கம் {{ customer_name }}.
உங்கள் {{ product_type }} கணக்கைச் சார்ந்த ஒரு முக்கியமான முறையான தகவலை {{ client_name }} சார்பில் பகிர்கிறேன்.
எங்கள் பதிவுகளின்படி இந்தக் கணக்கின் முதற்கட்ட தொகை {{ loan_amount }} மற்றும் தற்போதைய மொத்த நிலுவை {{ tos }} ஆகும்.
{{ lan }} என்ற கணக்கில் நிலுவைத் தொகை குறித்து முன்பும் தொடர்பு கொண்டிருந்தோம், ஆனால் அது இன்னும் சரியாகவில்லை.
இந்த அறிவிப்பை மிகுந்த கவனத்துடன் எடுத்துக்கொண்டு, கட்டணம் செலுத்துவது அல்லது திருப்பிச் செலுத்தும் திட்டம் பற்றி பேச உடனே {{ contact_details }} எண்ணில் தொடர்புகொள்ளுங்கள்.
சரியான நேரத்தில் பதிலளிப்பது மேலும் ஏறத்தாழ உயர்வதைத் தவிர்க்க உதவும்.
நன்றி.`,
  Telugu: `నమస్కారం {{ customer_name }}.
మీ {{ product_type }} ఖాతాకు సంబంధించిన ఒక ముఖ్యమైన అధికారిక సమాచారాన్ని {{ client_name }} తరఫున తెలియజేస్తున్నాను.
మా రికార్డుల ప్రకారం ఈ ఖాతా యొక్క ప్రాథమిక మొత్తం {{ loan_amount }} కాగా, ప్రస్తుతం మొత్తం బకాయి {{ tos }} ఉంది.
ఖాతా సంఖ్య {{ lan }} లో పెండింగ్ చెల్లింపుల గురించి మేము ముందుగానే సమాచారం ఇచ్చినా, ఇప్పటికీ పరిస్థితి సరిగా లేదు.
దయచేసి ఈ సమాచారాన్ని గంభీరంగా తీసుకుని, చెల్లింపు లేదా తిరిగి చెల్లింపు ఎంపికలపై చర్చించడానికి వెంటనే {{ contact_details }} ను సంప్రదించండి.
సమయానికి స్పందిస్తే తదుపరి ఎస్కలేషన్‌ను నివారించడంలో సహాయం కావచ్చు.
ధన్యవాదాలు.`,
  Kannada: `ನಮಸ್ಕಾರ {{ customer_name }}.
ನಿಮ್ಮ {{ product_type }} ಖಾತೆಗೆ ಸಂಬಂಧಿಸಿದ ಮಹತ್ವದ ಅಧಿಕೃತ ಮಾಹಿತಿಯನ್ನು {{ client_name }} ಪರವಾಗಿ ಹಂಚಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ.
ನಮ್ಮ ದಾಖಲೆಗಳ ಪ್ರಕಾರ ಈ ಖಾತೆಯ ಮೂಲ ಮೊತ್ತ {{ loan_amount }} ಆಗಿದ್ದು, ಪ್ರಸ್ತುತ ಒಟ್ಟು ಬಾಕಿ {{ tos }} ಆಗಿದೆ.
ಖಾತೆ ಸಂಖ್ಯೆ {{ lan }} ಕುರಿತು ಬಾಕಿ ಪಾವತಿ ಬಗ್ಗೆ ಮೊದಲುಲೂ ಸಂಪರ್ಕಿಸಲಾಗಿದೆ, ಆದರೆ ಪರಿಸ್ಥಿತಿ ಇನ್ನೂ ಸರಿಯಾಗಿಲ್ಲ.
ದಯವಿಟ್ಟು ಈ ಮಾಹಿತಿಯನ್ನು ಗಂಭೀರವಾಗಿ ಪರಿಗಣಿಸಿ ಮತ್ತು ಪಾವತಿ ಅಥವಾ ಮರುಪಾವತಿ ಆಯ್ಕೆಗಳ ಕುರಿತು ಚರ್ಚಿಸಲು ತಕ್ಷಣ {{ contact_details }} ಅನ್ನು ಸಂಪರ್ಕಿಸಿ.
ಸಮಯಕ್ಕೆ ಪ್ರತಿಕ್ರಿಯಿಸುವುದರಿಂದ ಮುಂದಿನ ಏರಿಕೆಯನ್ನು ತಪ್ಪಿಸಲು ಸಹಾಯವಾಗಬಹುದು.
ಧನ್ಯವಾದಗಳು.`,
  Bengali: `নমস্কার {{ customer_name }}।
আপনার {{ product_type }} অ্যাকাউন্ট সম্পর্কে {{ client_name }}-এর পক্ষ থেকে একটি গুরুত্বপূর্ণ আনুষ্ঠানিক বার্তা জানানো হচ্ছে।
আমাদের নথি অনুযায়ী এই অ্যাকাউন্টের মূল পরিমাণ ছিল {{ loan_amount }} এবং বর্তমান মোট বকেয়া {{ tos }}।
অ্যাকাউন্ট নম্বর {{ lan }}-এর বকেয়া সম্পর্কে আগেও যোগাযোগ করা হয়েছে, কিন্তু বিষয়টি এখনও মীমাংসিত নয়।
অনুগ্রহ করে বিষয়টিকে গুরুত্ব সহকারে নিন এবং অর্থপ্রদান বা পুনর্গঠন নিয়ে আলোচনা করতে অবিলম্বে {{ contact_details }} নম্বরে যোগাযোগ করুন।
সময়মতো সাড়া দিলে পরবর্তী অ্যাকাউন্ট এস্কেলেশন এড়াতে সহায়তা করতে পারে।
ধন্যবাদ।`,
  Gujarati: `નમસ્તે {{ customer_name }}.
તમારા {{ product_type }} ખાતા સંબંધિત એક મહત્વપૂર્ણ ઔપચારિક માહિતી {{ client_name }} તરફથી શેર કરવામાં આવી રહી છે.
અમારી નોંધ મુજબ આ ખાતાની મૂળ રકમ {{ loan_amount }} હતી અને હાલમાં કુલ બાકી રકમ {{ tos }} છે.
ખાતા નંબર {{ lan }} અંગે બાકી ચૂકવણી વિશે અગાઉ પણ સંપર્ક કરવામાં આવ્યો હતો, છતાં સ્થિતિ હજુ સુધરી નથી.
કૃપા કરીને આ સૂચનાને ગંભીરતાથી લો અને ચુકવણી અથવા પુનઃચુકવણી વિકલ્પ પર ચર્ચા કરવા માટે તરત જ {{ contact_details }} પર સંપર્ક કરો.
સમયસર પ્રતિસાદ આપવાથી આગળની એસ્કેલેશન ટાળી શકાય છે.
આભાર.`,
  Malayalam: `നമസ്കാരം {{ customer_name }}.
നിങ്ങളുടെ {{ product_type }} അക്കൗണ്ടിനെ സംബന്ധിച്ച ഒരു പ്രധാന ഔദ്യോഗിക വിവരമാണ് {{ client_name }}യുടെ ഭാഗത്തുനിന്ന് അറിയിക്കുന്നത്.
ഞങ്ങളുടെ രേഖകൾ പ്രകാരം ഈ അക്കൗണ്ടിന്റെ ആദ്യ മൂല്യം {{ loan_amount }} ആയിരുന്നു, നിലവിലെ മൊത്തം കുടിശ്ശിക {{ tos }} ആണ്.
അക്കൗണ്ട് നമ്പർ {{ lan }} സംബന്ധിച്ച കുടിശ്ശികയെ കുറിച്ച് മുമ്പും അറിയിച്ചിരുന്നുവെങ്കിലും പ്രശ്നം ഇതുവരെ പരിഹരിക്കപ്പെട്ടിട്ടില്ല.
ദയവായി ഈ അറിയിപ്പിനെ ഗൗരവമായി കാണുകയും അടവ് അല്ലെങ്കിൽ പുനഃക്രമീകരണ സാധ്യതകളെക്കുറിച്ച് ഉടൻ {{ contact_details }} എന്ന നമ്പറിൽ ബന്ധപ്പെടുകയും ചെയ്യുക.
സമയോചിതമായ പ്രതികരണം തുടർ എസ്കലേഷൻ ഒഴിവാക്കാൻ സഹായകരമായേക്കാം.
നന്ദി.`,
  Punjabi: `ਨਮਸਤੇ {{ customer_name }}।
ਤੁਹਾਡੇ {{ product_type }} ਖਾਤੇ ਬਾਰੇ {{ client_name }} ਵਲੋਂ ਇੱਕ ਮਹੱਤਵਪੂਰਨ ਰਸਮੀ ਸੂਚਨਾ ਸਾਂਝੀ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ।
ਸਾਡੇ ਰਿਕਾਰਡ ਅਨੁਸਾਰ ਇਸ ਖਾਤੇ ਦੀ ਮੁੱਢਲੀ ਰਕਮ {{ loan_amount }} ਸੀ ਅਤੇ ਮੌਜੂਦਾ ਕੁੱਲ ਬਕਾਇਆ {{ tos }} ਹੈ।
ਖਾਤਾ ਨੰਬਰ {{ lan }} ਉੱਤੇ ਬਕਾਇਆ ਭੁਗਤਾਨ ਬਾਰੇ ਪਹਿਲਾਂ ਵੀ ਸੰਪਰਕ ਕੀਤਾ ਗਿਆ ਸੀ, ਪਰ ਮਾਮਲਾ ਹਾਲੇ ਤੱਕ ਹੱਲ ਨਹੀਂ ਹੋਇਆ।
ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਸੁਚਨਾ ਨੂੰ ਗੰਭੀਰਤਾ ਨਾਲ ਲਓ ਅਤੇ ਭੁਗਤਾਨ ਜਾਂ ਵਾਪਸੀ ਦੇ ਵਿਕਲਪਾਂ ਬਾਰੇ ਗੱਲ ਕਰਨ ਲਈ ਤੁਰੰਤ {{ contact_details }} 'ਤੇ ਸੰਪਰਕ ਕਰੋ।
ਸਮੇਂ ਸਿਰ ਜਵਾਬ ਦੇਣ ਨਾਲ ਅੱਗੇ ਦੀ ਐਸਕਲੇਸ਼ਨ ਤੋਂ ਬਚਣ ਵਿੱਚ ਮਦਦ ਮਿਲ ਸਕਦੀ ਹੈ।
ਧੰਨਵਾਦ।`,
};

export const REMOTION_SUPPORTED_LANGUAGES = [...REMOTION_VOICE_LANGUAGES];

export function getDefaultRemotionTranscript(language: string): string {
  return REMOTION_TEMPLATES[language] ?? REMOTION_TEMPLATES.Hindi;
}
