export type Gender = "male" | "female";

export function resolveNarratorGender(gender: "male" | "female" | null): Gender {
  return gender === "male" ? "male" : "female";
}

interface GenderedTemplate {
  male: string;
  female: string;
}

type TemplateValue = string | GenderedTemplate;
export type RemotionTemplateKey = "account_notice" | "payment_guidance";

function getGenderedText(value: TemplateValue, gender: Gender): string {
  if (typeof value === "string") return value;
  return value[gender];
}

export const REMOTION_TEMPLATES: Record<string, TemplateValue> = {
  English: `Hello {{ customer_name }}.
I am speaking on behalf of {{ client_name }} with an important formal update regarding your {{ product_type }} account.
Our records show that the original account value was {{ loan_amount }} and your current outstanding balance is {{ tos }}.
Despite earlier reminders, the overdue amount on account {{ lan }} remains unresolved.
Please treat this communication seriously and contact us immediately at {{ contact_details }} to discuss payment or a suitable repayment arrangement.
An early response may help avoid further account escalation.
Thank you.`,
  Hindi: {
    male: `नमस्ते {{ customer_name }}।
मैं {{ client_name }} की ओर से आपके {{ product_type }} खाते के संबंध में एक महत्वपूर्ण औपचारिक सूचना साझा कर रहा हूँ।
हमारी जानकारी के अनुसार इस खाते की मूल राशि {{ loan_amount }} थी और वर्तमान कुल बकाया राशि {{ tos }} है।
खाता संख्या {{ lan }} पर लंबित भुगतान के बारे में पहले भी सूचित किया गया था, लेकिन स्थिति अभी तक सामान्य नहीं हुई है।
कृपया इस सूचना को गंभीरता से लें और भुगतान अथवा पुनर्भुगतान विकल्प पर चर्चा के लिए तुरंत {{ contact_details }} पर संपर्क करें।
समय पर प्रतिक्रिया देने से आगे की एस्कलेशन से बचने में मदद मिल सकती है।
धन्यवाद।`,
    female: `नमस्ते {{ customer_name }}।
मैं {{ client_name }} की ओर से आपके {{ product_type }} खाते के संबंध में एक महत्वपूर्ण औपचारिक सूचना साझा कर रही हूँ।
हमारी जानकारी के अनुसार इस खाते की मूल राशि {{ loan_amount }} थी और वर्तमान कुल बकाया राशि {{ tos }} है।
खाता संख्या {{ lan }} पर लंबित भुगतान के बारे में पहले भी सूचित किया गया था, लेकिन स्थिति अभी तक सामान्य नहीं हुई है।
कृपया इस सूचना को गंभीरता से लें और भुगतान अथवा पुनर्भुगतान विकल्प पर चर्चा के लिए तुरंत {{ contact_details }} पर संपर्क करें।
समय पर प्रतिक्रिया देने से आगे की एस्कलेशन से बचने में मदद मिल सकती है।
धन्यवाद।`
  },
  Marathi: `नमस्कार {{ customer_name }}.
मी {{ client_name }} कडून तुमच्या {{ product_type }} खात्याबाबत एक महत्त्वाची औपचारिक माहिती देत आहे.
आमच्या नोंदीप्रमाणे या खात्याची मूळ रक्कम {{ loan_amount }} होती आणि सध्या एकूण थकबाकी {{ tos }} आहे.
खाते क्रमांक {{ lan }} वरील थकबाकीबद्दल यापूर्वीही कळविण्यात आले होते, तरीही स्थितीत सुधारणा झालेली नाही.
कृपया या सूचनेला गांभीर्याने घ्या आणि पेमेंट किंवा परतफेडीच्या पर्यायांबाबत त्वरित {{ contact_details }} वर संपर्क साधा.
वेळेत प्रतिसाद दिल्यास पुढील एस्कलेशन टाळता येऊ शकते.
धन्यवाद.`,
  Tamil: `வணக்கம் {{ customer_name }}.
உங்கள் {{ product_type }} கணக்கைச் சார்ந்த ஒரு முக்கியமான முறையான தகவலை {{ client_name }} சார்பில் பகிரிறேன்.
எங்கள் பதிவுகளின்படி இந்தக் கணக்கின் முதற்கட்ட தொகை {{ loan_amount }} மற்றும் தற்போதைய மொத்த நிலுவை {{ tos }} ஆகும்.
{{ lan }} என்ற கணக்கில் நிலுவைத் தொகை குறித்து முன்பும் தொடர்பு கொண்டிருந்தோம், ஆனால் அது இன்னும் சரியாகவில்லை.
இந்த அறிவிப்பை மிகுந்த கவனத்துடன் எடுத்துக்கொண்டு, கட்டணம் செலுத்துவது அல்லது திருப்பிச் செலுத்தும் திட்டம் பற்றி பேச உடனே {{ contact_details }} எண்ணில் தொடர்புகொள்ளுங்கள்.
சரியான நேரத்தில் பதிலளிப்பது மேலும் ஏறத்தாழ உயர்வதைத் தவிர்க்க உதவும்.
நன்றி.`,
  Telugu: `నమస్కారం {{ customer_name }}.
మీ {{ product_type }} ఖాతాకు సంబంధించిన ఒక ముఖ్యమైన అధికారిక సమాచారాన్ని {{ client_name }} తరఫున తెలియజేస్తున్నాను.
మా రికార్డుల ప్రకారం ఈ ఖాతా యొక్క ప్రాథమిక మొత్తం {{ loan_amount }} కాగా, ప్రస్తుతం మొత్తం బకాయి {{ tos }} ఉంది.
ఖాతా సంఖ్య {{ lan }} లో పెండింగ్ చెల్లింపుల గురించి మేము ముందుగానే సమాచారం ఇచ్చినా, ఇప్పటికీ పరిస్థితి సరిగా లేదు.
దయచేసి ఈ సమాచారాన్ని గంభీరంగా తీసుకుని, చెల్లింపు లేదా తగిన పరిష్కారం గురించి చర్చించడానికి వెంటనే మా కార్యాలయాన్ని సంప్రదించండి.
సమయానికి స్పందిస్తే తదుపరి ఎస్కలేషన్‌ను నివారించడంలో సహాయం కావచ్చు.
ధన్యవాਦాలు.`,
  Kannada: `ನಮಸ್ಕಾರ {{ customer_name }}.
ನಿಮ್ಮ {{ product_type }} ಖಾತೆಗೆ ಸಂಬಂಧಿಸಿದ ಮಹತ್ವದ ಅಧಿಕೃತ ಮಾಹಿತಿಯನ್ನು {{ client_name }} ಪರವಾಗಿ ಹಂಚಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ.
ನಮ್ಮ ದಾಖಲೆಗಳ ಪ್ರಕಾರ ಈ ಖಾತೆಯ ಮೂಲ ಮೊತ್ತ {{ loan_amount }} ಆಗಿದ್ದು, ಪ್ರಸ್ತುತ ಒಟ್ಟು ಬಾಕಿ {{ tos }} ಆಗಿದೆ.
ಖಾತೆ ಸಂಖ್ಯೆ {{ lan }} ಕುರಿತು ಬಾಕಿ ಪಾವತಿ ಬಗ್ಗೆ ಮೊದಲುಲೂ ಸಂಪರ್ಕಿಸಲಾಗಿದೆ, ಆದರೆ ಪರಿಸ್ಥಿತಿ ಇನ್ನೂ ಸರಿಯಾಗಿಲ್ಲ.
ದಯವಿಟ್ಟು ಈ ಮಾಹಿತಿಯನ್ನು ಗಂಭೀರವಾಗಿ ಪರಿಗಣಿಸಿ ಮತ್ತು ಮರುಪಾವತಿ ಆಯ್ಕೆಗಳ ಕುರಿತು ಚರ್ಚಿಸಲು ತಕ್ಷಣ {{ contact_details }} ಅನ್ನು ಸಂಪರ್ಕಿಸಿ.
ಸಮಯಕ್ಕೆ ಪ್ರತಿಕ್ರಿಯಿಸುವುದರಿಂದ ಮುಂದಿನ ಏರಿಕೆಯನ್ನು ತಪ್ಪಿಸಲು ಸಹಾಯವಾಗಬಹುದು.
ಧನ್ಯವಾದಗಳು.`,
  Bengali: `নমস্কার {{ customer_name }}।
আপনার {{ product_type }} অ্যাকাউন্ট সম্পর্কে {{ client_name }}-এর পক্ষ থেকে একটি গুরুত্বপূর্ণ আনুষ্ঠানিক বার্তা জানানো হচ্ছে।
আমাদের নথি অনুযায়ী এই অ্যাকাউন্টের মূল পরিমাণ ছিল {{ loan_amount }} এবং বর্তমান মোট বকেয়া {{ tos }}।
অ্যাকাউন্ট নম্বর {{ lan }}-এর বকেয়া সম্পর্কে আগেও যোগাযোগ করা হয়েছে, কিন্তু বিষয়টি এখনও মীমাংসিত নয়।
অনুগ্রহ করে বিষয়টিকে গুরুত্ব সহকারে নিন এবং অর্থপ্রদান বা পুনর্গঠন নিয়ে আলোচনা করতে অবিলম্বে {{ contact_details }} নম্বরে যোগাযোগ করুন।
সময়মতো সাড়া দিলে পরবর্তী অ্যাকাউন্ট এস্কেলেশন এড়াতে সহায়তা করতে পারে।
ধন্যবাদ।`,
  Gujarati: {
    male: `નમસ્તે {{ customer_name }}.
હું {{ client_name }} તરફથી તમારા {{ product_type }} ખાતા સંબંધિત એક મહત્વપૂર્ણ ઔપચારિક માહિતી શેર કરી રહ્યો છું.
અમારી નોંધ મુજબ આ ખાતાની મૂળ રકમ {{ loan_amount }} હતી અને હાલમાં કુલ બાકી રકમ {{ tos }} છે.
ખાતા નંબર {{ lan }} અંગે બાકી ચૂકવણી વિશે અગાઉ પણ સંપર્ક કરવામાં આવ્યો હતો, છતાં સ્થિતિ હજુ સુધરી નથી.
કૃપા કરીને આ સૂચનાને ગંભીરતાથી લો અને ચુકવણી અથવા પુનઃચુકવણી વિકલ્પ પર ચર્ચા કરવા માટે તરત જ {{ contact_details }} પર સંપર્ક કરો.
સમયસર પ્રતિસાદ આપવાથી આગળની એસ્કેલેશન ટાળી શકાય છે.
આભાર.`,
    female: `નમસ્તે {{ customer_name }}.
હું {{ client_name }} તરફથી તમારા {{ product_type }} ખાતા સંબંધિત એક મહત્વપૂર્ણ ઔપચારિક માહિતી શેર કરી રહી છું.
અમારી નોંધ મુજબ આ ખાતાની મૂળ રકમ {{ loan_amount }} હતી અને હાલમાં કુલ બાકી રકમ {{ tos }} છે.
ખાતા નંબર {{ lan }} અંગે બાકી ચૂકવણી વિશે અગાઉ પણ સંપર્ક કરવામાં આવ્યો હતો, છતાં સ્થિતિ હજુ સુધરી નથી.
કૃપા કરીને આ સૂચનાને ગંભીરતાથી લો અને ચુકવણી અથવા પુનઃચુકવણી વિકલ્પ પર ચર્ચા કરવા માટે તરત જ {{ contact_details }} પર સંપર્ક કરો.
સમયસર પ્રતિસાદ આપવાથી આગળની એસ્કેલેશન ટાળી શકાય છે.
આભાર.`
  },
  Malayalam: `നമസ്കാരം {{ customer_name }}.
നിങ്ങളുടെ {{ product_type }} അക്കൗണ്ടിനെ സംബന്ധിച്ച ഒരു പ്രധാന ഔദ്യോഗിക വിവരമാണ് {{ client_name }}യുടെ ഭാഗത്തുനിന്ന് അറിയിക്കുന്നത്.
ഞങ്ങളുടെ രേഖകൾ പ്രകാരം ഈ അക്കൗണ്ടിന്റെ ആദ്യ മൂല്യം {{ loan_amount }} ആയിരുന്നു, നിലവിലെ മൊത്തം കുടിശ്ശിക {{ tos }} ആണ്.
അക്കൗണ്ട് നമ്പർ {{ lan }} സംബന്ധിച്ച കുടിശ്ശികയെ കുറിച്ച് മുമ്പും അറിയിച്ചിരുന്നുവെങ്കിലും പ്രശ്നം ഇതുവരെ പരിഹരിക്കപ്പെട്ടിട്ടില്ല.
ദയവായി ഈ അറിയിപ്പിനെ ഗൗരവമായി കാണുകയും അടവ് അല്ലെങ്കിൽ പുനഃക്രമീകരണ സാധ്യതകളെക്കുറിച്ച് ഉടൻ {{ contact_details }} എന്ന നമ്പറിൽ ബന്ധപ്പെടുകയും ചെയ്യുക.
സമയോചിതമായ പ്രതികരണം തുടർ എസ്കലേഷൻ ഒഴിവാക്കാൻ സഹായകരമായേക്കാം.
നന്ദി.`,
  Punjabi: {
    male: `ਨਮਸਤੇ {{ customer_name }}।
ਮੈਂ {{ client_name }} ਵਲੋਂ ਤੁਹਾਡੇ {{ product_type }} ਖਾਤੇ ਬਾਰੇ ਇੱਕ ਮਹੱਤਵਪੂਰਨ ਰਸਮੀ ਸੂਚਨਾ ਸਾਂਝੀ ਕਰ ਰਿਹਾ ਹਾਂ।
ਸਾਡੇ ਰਿਕਾਰਡ ਅਨੁਸਾਰ ਇਸ ਖਾਤੇ ਦੀ ਮੁੱਢਲੀ ਰਕਮ {{ loan_amount }} ਸੀ ਅਤੇ ਮੌਜੂਦਾ ਕੁੱਲ ਬਕਾਇਆ {{ tos }} ਹੈ।
ਖਾਤਾ ਨੰਬਰ {{ lan }} ਉੱਤੇ ਬਕਾਇਆ ਭੁਗਤਾਨ ਬਾਰੇ ਪਹਿਲਾਂ ਵੀ ਸੰਪਰਕ ਕੀਤਾ ਗਿਆ ਸੀ, ਪਰ ਮਾਮਲਾ ਹਾਲੇ ਤੱਕ ਹੱਲ ਨਹੀਂ ਹੋਇਆ।
ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਸੁਚਨਾ ਨੂੰ ਗੰਭੀਰਤਾ ਨਾਲ ਲਓ ਅਤੇ ਭੁਗਤਾਨ ਜਾਂ ਵਾਪਸੀ ਦੇ ਵਿਕਲਪਾਂ ਬਾਰੇ ਗੱਲ ਕਰਨ ਲਈ ਤੁਰੰਤ {{ contact_details }} 'ਤੇ ਸੰਪਰਕ ਕਰੋ।
ਸਮੇਂ ਸਿਰ ਜਵਾਬ ਦੇਣ ਨਾਲ ਅੱਗੇ ਦੀ ਐਸਕਲੇਸ਼ਨ ਤੋਂ ਬਚਣ ਵਿੱਚ ਮਦਦ ਮਿਲ ਸਕਦੀ ਹੈ।
ਧੰਨਵਾਦ।`,
    female: `ਨਮਸਤੇ {{ customer_name }}।
ਮੈਂ {{ client_name }} ਵਲੋਂ ਤੁਹਾਡੇ {{ product_type }} ਖਾਤੇ ਬਾਰੇ ਇੱਕ ਮਹੱਤਵਪੂਰਨ ਰਸਮੀ ਸੂਚਨਾ ਸਾਂਝੀ ਕਰ ਰਹੀ ਹਾਂ।
ਸਾਡੇ ਰਿਕਾਰਡ ਅਨੁਸਾਰ ਇਸ ਖਾਤੇ ਦੀ ਮੁੱਢਲੀ ਰਕਮ {{ loan_amount }} ਸੀ ਅਤੇ ਮੌਜੂਦਾ ਕੁੱਲ ਬਕਾਇਆ {{ tos }} ਹੈ।
ਖਾਤਾ ਨੰਬਰ {{ lan }} ਉੱਤੇ ਬਕਾਇਆ ਭੁਗਤਾਨ ਬਾਰੇ ਪਹਿਲਾਂ ਵੀ ਸੰਪਰਕ ਕੀਤਾ ਗਿਆ ਸੀ, ਪਰ ਮਾਮਲਾ ਹਾਲੇ ਤੱਕ ਹੱਲ ਨਹੀਂ ਹੋਇਆ।
ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਸੁਚਨਾ ਨੂੰ ਗੰਭੀਰਤਾ ਨਾਲ ਲਓ ਅਤੇ ਭੁਗਤਾਨ ਜਾਂ ਵਾਪਸੀ ਦੇ ਵਿਕਲਪਾਂ ਬਾਰੇ ਗੱਲ ਕਰਨ ਲਈ ਤੁਰੰਤ {{ contact_details }} 'ਤੇ ਸੰਪਰਕ ਕਰੋ।
ਸਮੇਂ ਸਿਰ ਜਵਾਬ ਦੇਣ ਨਾਲ ਅੱਗੇ ਦੀ ਐਸਕਲੇਸ਼ਨ ਤੋਂ ਬਚਣ ਵਿੱਚ ਮਦਦ ਮਿਲ ਸਕਦੀ ਹੈ।
ਧੰਨਵਾਦ।`
  }
};

export const PAYMENT_GUIDANCE_TEMPLATES: Record<string, TemplateValue> = {
  English: `Welcome {{ customer_name }}.
This is a personalized payment guidance video for your {{ client_name }} loan account {{ lan }}.
Step one: Open the PhonePe app on your phone, scroll to Recharge and Bills, and tap Loan Repayment.
Step two: On the Select your Lender page, choose TVS Credit from the list of loan billers.
Step three: Enter your Agreement number {{ lan }}, tap Confirm, and pay the amount {{ tos }}.
For any other information or support, please contact {{ contact_details }}.
Thank you.`,
  Hindi: {
    male: `नमस्ते {{ customer_name }}।
यह आपके {{ client_name }} लोन अकाउंट {{ lan }} के लिए एक व्यक्तिगत भुगतान मार्गदर्शन वीडियो है।
पहला चरण: अपने फोन पर PhonePe ऐप खोलें, Recharge and Bills सेक्शन में जाएं और Loan Repayment पर टैप करें।
दूसरा चरण: Select your Lender पेज पर लोन बिलर्स की सूची में से TVS Credit चुनें।
तीसरा चरण: अपना Agreement number {{ lan }} दर्ज करें, Confirm पर टैप करें और देय राशि {{ tos }} का भुगतान करें।
किसी भी अन्य जानकारी या सहायता के लिए कृपया {{ contact_details }} पर संपर्क करें।
धन्यवाद।`,
    female: `नमस्ते {{ customer_name }}।
यह आपके {{ client_name }} लोन अकाउंट {{ lan }} के लिए एक व्यक्तिगत भुगतान मार्गदर्शन वीडियो है।
पहला चरण: अपने फोन पर PhonePe ऐप खोलें, Recharge and Bills सेक्शन में जाएं और Loan Repayment पर टैप करें।
दूसरा चरण: Select your Lender पेज पर लोन बिलर्स की सूची में से TVS Credit चुनें।
तीसरा चरण: अपना Agreement number {{ lan }} दर्ज करें, Confirm पर टैप करें और देय राशि {{ tos }} का भुगतान करें।
किसी भी अन्य जानकारी या सहायता के लिए कृपया {{ contact_details }} पर संपर्क करें।
धन्यवाद।`
  },
  Marathi: `नमस्कार {{ customer_name }}.
हा तुमच्या {{ client_name }} लोन खाते {{ lan }} साठी वैयक्तिक पेमेंट मार्गदर्शन व्हिडिओ आहे.
पहिली पायरी: तुमच्या फोनवर PhonePe अॅप उघडा, Recharge and Bills विभागात जा आणि Loan Repayment वर टॅप करा.
दुसरी पायरी: Select your Lender पेजवर लोन बिलर्सच्या यादीतून TVS Credit निवडा.
तिसरी पायरी: तुमचा Agreement number {{ lan }} प्रविष्ट करा, Confirm वर टॅप करा आणि देय रक्कम {{ tos }} भरा.
इतर कोणत्याही माहितीसाठी किंवा सहाय्यासाठी कृपया {{ contact_details }} वर संपर्क करा.
धन्यवाद.`,
  Tamil: `வணக்கம் {{ customer_name }}.
உங்கள் {{ client_name }} கடன் கணக்கு {{ lan }} க்கான தனிப்பட்ட கட்டண வழிகாட்டி வீடியோ இது.
படி ஒன்று: உங்கள் ஃபோனில் PhonePe ஆப்பைத் திறந்து, Recharge and Bills பகுதிக்குச் சென்று, Loan Repayment-ஐ தட்டவும்.
படி இரண்டு: Select your Lender பக்கத்தில் கடன் பில்லர்கள் பட்டியலிலிருந்து TVS Credit-ஐ தேர்ந்தெடுக்கவும்.
படி மூன்று: உங்கள் Agreement number {{ lan }}-ஐ உள்ளிட்டு, Confirm-ஐ தட்டவும், செலுத்த வேண்டிய தொகை {{ tos }}-ஐ செலுத்தவும்.
வேறு தகவல் அல்லது உதவிக்கு {{ contact_details }} எண்ணில் தொடர்புகொள்ளவும்.
நன்றி.`,
  Telugu: `నమస్కారం {{ customer_name }}.
ఇది మీ {{ client_name }} లోన్ ఖాతా {{ lan }} కోసం వ్యక్తిగత చెల్లింపు మార్గదర్శక వీడియో.
దశ ఒకటి: మీ ఫోన్‌లో PhonePe యాప్ తెరిచి, Recharge and Bills విభాగానికి వెళ్లి, Loan Repayment పై ట్యాప్ చేయండి.
దశ రెండు: Select your Lender పేజీలో లోన్ బిల్లర్ల జాబితా నుండి TVS Credit ఎంచుకోండి.
దశ మూడు: మీ Agreement number {{ lan }} నమోదు చేసి, Confirm పై ట్యాప్ చేసి, చెల్లించవలసిన మొత్తం {{ tos }} చెల్లించండి.
ఇతర సమాచారం లేదా సహాయం కోసం దయచేసి {{ contact_details }} ని సంప్రదించండి.
ధన్యవాదాలు.`,
  Kannada: `ನಮಸ್ಕಾರ {{ customer_name }}.
ಇದು ನಿಮ್ಮ {{ client_name }} ಸಾಲ ಖಾತೆ {{ lan }} ಗಾಗಿ ವೈಯಕ್ತಿಕ ಪಾವತಿ ಮಾರ್ಗದರ್ಶಿ ವೀಡಿಯೊ.
ಹಂತ ಒಂದು: ನಿಮ್ಮ ಫೋನ್‌ನಲ್ಲಿ PhonePe ಆಪ್ ತೆರೆದು, Recharge and Bills ವಿಭಾಗಕ್ಕೆ ಹೋಗಿ, Loan Repayment ಮೇಲೆ ಟ್ಯಾಪ್ ಮಾಡಿ.
ಹಂತ ಎರಡು: Select your Lender ಪುಟದಲ್ಲಿ ಸಾಲ ಬಿಲ್ಲರ್‌ಗಳ ಪಟ್ಟಿಯಿಂದ TVS Credit ಆಯ್ಕೆಮಾಡಿ.
ಹಂತ ಮೂರು: ನಿಮ್ಮ Agreement number {{ lan }} ನಮೂದಿಸಿ, Confirm ಮೇಲೆ ಟ್ಯಾಪ್ ಮಾಡಿ, ಪಾವತಿಸಬೇಕಾದ ಮೊತ್ತ {{ tos }} ಪಾವತಿಸಿ.
ಯಾವುದೇ ಇತರ ಮಾಹಿತಿ ಅಥವಾ ಸಹಾಯಕ್ಕಾಗಿ ದಯವಿಟ್ಟು {{ contact_details }} ಗೆ ಸಂಪರ್ಕಿಸಿ.
ಧನ್ಯವಾದಗಳು.`,
  Bengali: `নমস্কার {{ customer_name }}।
এটি আপনার {{ client_name }} ঋণ অ্যাকাউন্ট {{ lan }}-এর জন্য একটি ব্যক্তিগত পেমেন্ট নির্দেশিকা ভিডিও।
ধাপ এক: আপনার ফোনে PhonePe অ্যাপ খুলুন, Recharge and Bills বিভাগে যান এবং Loan Repayment-এ ট্যাপ করুন।
ধাপ দুই: Select your Lender পেজে ঋণ বিলারদের তালিকা থেকে TVS Credit নির্বাচন করুন।
ধাপ তিন: আপনার Agreement number {{ lan }} লিখুন, Confirm-এ ট্যাপ করুন এবং প্রদেয় পরিমাণ {{ tos }} পরিশোধ করুন।
অন্য কোনও তথ্য বা সহায়তার জন্য অনুগ্রহ করে {{ contact_details }}-এ যোগাযোগ করুন।
ধন্যবাদ।`,
  Gujarati: `નમસ્તે {{ customer_name }}.
આ તમારા {{ client_name }} લોન ખાતા {{ lan }} માટે વ્યક્તિગત ચુકવણી માર્ગદર્શન વિડિયો છે.
પગલું એક: તમારા ફોન પર PhonePe એપ ખોલો, Recharge and Bills વિભાગમાં જાઓ અને Loan Repayment પર ટેપ કરો.
પગલું બે: Select your Lender પૃષ્ઠ પર લોન બિલર્સની યાદીમાંથી TVS Credit પસંદ કરો.
પગલું ત્રણ: તમારો Agreement number {{ lan }} દાખલ કરો, Confirm પર ટેપ કરો અને ચુકવવાની રકમ {{ tos }} ચૂકવો.
અન્ય માહિતી અથવા સહાય માટે કૃપા કરીને {{ contact_details }} પર સંપર્ક કરો.
આભાર.`,
  Malayalam: `നമസ്കാരം {{ customer_name }}.
ഇത് നിങ്ങളുടെ {{ client_name }} വായ്പ അക്കൗണ്ട് {{ lan }} നുള്ള വ്യക്തിഗത പേയ്മെന്റ് ഗൈഡ് വീഡിയോയാണ്.
ഘട്ടം ഒന്ന്: നിങ്ങളുടെ ഫോണിൽ PhonePe ആപ്പ് തുറന്ന്, Recharge and Bills വിഭാഗത്തിലേക്ക് പോകുക, Loan Repayment ടാപ്പ് ചെയ്യുക.
ഘട്ടം രണ്ട്: Select your Lender പേജിൽ വായ്പ ബില്ലർമാരുടെ പട്ടികയിൽ നിന്ന് TVS Credit തിരഞ്ഞെടുക്കുക.
ഘട്ടം മൂന്ന്: നിങ്ങളുടെ Agreement number {{ lan }} നൽകുക, Confirm ടാപ്പ് ചെയ്യുക, അടയ്ക്കേണ്ട തുക {{ tos }} അടയ്ക്കുക.
മറ്റ് വിവരങ്ങൾക്കോ സഹായത്തിനോ ദയവായി {{ contact_details }} ബന്ധപ്പെടുക.
നന്ദി.`,
};

export const REMOTION_TEMPLATE_OPTIONS: Array<{ key: RemotionTemplateKey; name: string; description: string }> = [
  {
    key: "account_notice",
    name: "Account Notice",
    description: "Formal personalized account update with amount and contact details.",
  },
  {
    key: "payment_guidance",
    name: "Payment Guidance",
    description: "Personalized walkthrough for paying through a link or PhonePe loan payment.",
  },
];

export const UNIVERSAL_TEMPLATES: Record<string, TemplateValue> = {
  English: `Hello. I am speaking on behalf of our team with an important formal update regarding your account. Our records show that the outstanding balance remains unresolved despite earlier communication. Please treat this notification seriously and contact our office immediately to discuss a suitable repayment arrangement. A timely response may help avoid further account escalation. Thank you.`,
  Hindi: {
    male: `नमस्ते। मैं हमारी टीम की ओर से आपके खाते के संबंध में एक महत्वपूर्ण औपचारिक सूचना साझा कर रहा हूँ। हमारी जानकारी के अनुसार आपके खाते का लंबित भुगतान अभी तक हल नहीं हुआ है। कृपया इस सूचना को गंभीरता से लें और पुनर्भुगतान विकल्प पर चर्चा के लिए तुरंत हमारे कार्यालय से संपर्क करें। समय पर प्रतिक्रिया देने से आगे की कार्रवाई से बचने में मदद मिल सकती है। धन्यवाद।`,
    female: `नमस्ते। मैं हमारी टीम की ओर से आपके खाते के संबंध में एक महत्वपूर्ण औपचारिक सूचना साझा कर रही हूँ। हमारी जानकारी के अनुसार आपके खाते का लंबित भुगतान अभी तक हल नहीं हुआ है। कृपया इस सूचना को गंभीरता से लें और पुनर्भुगतान विकल्प पर चर्चा के लिए तुरंत हमारे कार्यालय से संपर्क करें। समय पर प्रतिक्रिया देने से आगे की कार्रवाई से बचने में मदद मिल सकती है। धन्यवाद।`
  },
  Marathi: `नमस्कार. मी आमच्या टीमकडून तुमच्या खात्याबाबत एक महत्त्वाची औपचारिक माहिती देत आहे. आमच्या नोंदीप्रमाणे तुमच्या खात्यावरील थकबाकीबाबत अद्याપ निराकरण झालेले नाही. कृपया या सूचनेला गांभीर्याने घ्या आणि परतफेडीच्या पर्यायांबाबत त्वरित आमच्या कार्यालयाशी संपर्क साधा. वेळेत प्रतिसाद दिल्यास पुढील कारवाई टाळતા येऊ शकते. धन्यवाद.`,
  Tamil: `வணக்கம். உங்கள் கணக்கைப் பற்றிய ஒரு முக்கியமான முறையான தகவலை எங்கள் குழுவின் சார்பில் பகிரிறேன். எங்கள் பதிவுகளின்படி உங்கள் கணக்கின் நிலுவைத் தொகை இன்னும் சரியாகவில்லை. இந்த அறிவிப்பை மிகுந்த கவனத்துடன் எடுத்துக்கொண்டு, திருப்பிச் செலுத்தும் திட்டம் பற்றி பேச உடனே எங்களை அணுகவும். சரியான நேரத்தில் பதிலளிப்பது மேலதிக நடவடிக்கைகளைத் தவிர்க்க உதவும். நன்றி.`,
  Telugu: `నమస్కారం. మీ ఖాతాకు సంబంధించిన ఒక ముఖ్యమైన అధికారిక సమాచారాన్ని మా టీమ్ తరఫున తెలియజేస్తున్నాను. మా రికార్డుల ప్రకారం మీ ఖాతాలో బకాయి ఇంకా పరిష్కారం కాలేదు. దయచేసి ఈ సమాచారాన్ని గంభీరంగా తీసుకుని, తగిన పరిష్కారం గురించి చర్చించడానికి వెంటనే మా కార్యాలయాన్ని సంప్రదించండి. సమయానికి స్పందిస్తే తదుపరి చర్యలను నివారించడంలో సహాయం కావచ్చు. ధన్యవాదాలు.`,
  Kannada: `ನಮಸ್ಕಾರ. ನಿಮ್ಮ ಖಾತೆಗೆ ಸಂಬಂಧಿಸಿದ ಮಹತ್ವದ ಅಧಿಕೃತ ಮಾಹಿತಿಯನ್ನು ನಮ್ಮ ತಂಡದ ಪರವಾಗಿ ಹಂಚಿಕೊಳ್ಳುತ್ತಿದ್ದೇವೆ. ನಮ್ಮ ದಾಖಲೆಗಳ ಪ್ರಕಾರ ನಿಮ್ಮ ಖಾತೆಯ ಬಾಕಿ ಪಾವತಿ ಇನ್ನೂ ಸರಿಯಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಈ ಮಾಹಿತಿಯನ್ನು ಗಂಭೀರಗಳು ಪರಿಗಣಿಸಿ ಮತ್ತು ಮರುಪಾವತಿ ಆಯ್ಕೆಗಳ ಕುરીತು ಚರ್ಚಿಸಲು ತಕ್ಷಣ ನಮ್ಮ ಕಚೇರಿಯನ್ನು ಸಂಪರ್કಿಸಿ. ಸಮಯಕ್ಕೆ ಪ್ರತಿಕ್ರಿಯಿಸುವುದರಿಂದ ಮುಂದಿನ ಕ್ರಮವನ್ನು ತಪ್ಪಿಸಲು ಸಹಾಯವಾಗಬಹುದು. ಧನ್ಯವಾಗಳು.`,
  Bengali: `নমস্কার। আপনার অ্যাকাউন্ট সম্পর্কে আমাদের টিমের পক্ষ থেকে একটি গুরুত্বপূর্ণ আনুষ্ঠানিক বার্তা জানানো হচ্ছে। আমাদের নথি অনুযায়ী আপনার অ্যাকাউন্টের বকেয়া বিষয়টি এখনও মীমাংসিত নয়। অনুগ্রহ করে এই নোটিশটিকে গুরুত্ব সহকারে নিন এবং পুনর্গঠন নিয়ে আলোচনা করতে অবিলম্বে আমাদের অফিসে যোগাযোগ করুন। সময়মতো সাড়া দিলে পরবর্তী এস্কেলেশন এড়াতে সহায়তা করতে পারে। ধন্যবাদ।`,
  Gujarati: {
    male: `નમસ્તે. હું અમારી ટીમ તરફથી તમારા ખાતા સંબંધિત એક મહત્વપૂર્ણ ઔપચારિક માહિતી શેર કરી રહ્યો છું. અમારી નોંધ મુજબ તમારા ખાતાની બાકી ચૂકવણી હજુ સુધરી નથી. કૃપા કરીને આ સૂચનાને ગંભીરતાથી લો અને પુનઃચુકવણી વિકલ્પ પર ચર્ચા કરવા માટે તરત જ અમારી ઓફિસનો સંપર્ક કરો. સમયસર પ્રતિસાદ આપવાથી આગળની કાર્યવાહી ટાળી શકાય છે. આભાર.`,
    female: `નમસ્તે. હું અમારી ટીમ તરફથી તમારા ખાતા સંબંધિત એક મહત્વપૂર્ણ ઔપચારિક માહિતી શેર કરી રહી છું. અમારી નોંધ મુજબ તમારા ખાતાની બાકી ચૂકવણી હજુ સુધરી નથી. કૃપા કરીને આ સૂચનાને ગંભીરતાથી લો અને પુનઃચુકવણી વિકલ્પ પર ચર્ચા કરવા માટે તરત જ અમારી ઓફિસનો સંપર્ક કરો. સમયસર પ્રતિસાદ આપવાથી આગળની કાર્યવાહી ટાળી શકાય છે. આભાર.`
  },
  Malayalam: `നമസ്കാരം. നിങ്ങളുടെ അക്കൗണ്ടിനെ സംബന്ധിച്ച ഒരു പ്രധാന ഔദ്യോഗിക വിവരമാണ് ഞങ്ങളുടെ ടീമിന്റെ ഭാഗത്തുനിന്ന് അറിയിക്കുന്നത്. ഞങ്ങളുടെ രേഖകൾ പ്രകാരം നിങ്ങളുടെ അക്കൗണ്ടിലെ കുടിശ്ശിക ഇതുവരെ പരിഹരിക്കപ്പെട്ടിട്ടില്ല. ദയവായി ഈ അറിയിപ്പിനെ ഗൗരവമായി കാണുകയും ഉചിതമായ പരിહാരത്തെക്കുറിച്ച് ചർച്ച ചെയ്യാൻ ഉടൻ ഞങ്ങളുടെ ഓഫീസുമായി ബന്ധപ്പെടുകയും ചെയ്യുക. സമയോചിതമായ പ്രതികരണം തുടർനടപടികൾ ഒഴിവാക്കാൻ സഹાયകരമായേക്കാം. നന്ദി.`,
  Punjabi: {
    male: `ਨਮਸਤੇ। ਮੈਂ ਸਾਡੀ ਟੀਮ ਵਲੋਂ ਤੁਹਾਡੇ ਖਾਤੇ ਬਾਰੇ ਇੱਕ ਮਹੱਤਵਪੂਰਨ ਰਸਮੀ ਸੂਚਨਾ ਸਾਂਝੀ ਕਰ ਰਿਹਾ ਹਾਂ। ਸਾਡੇ ਰਿਕਾਰਡ ਅਨੁਸਾਰ ਤੁਹਾਡੇ ਖਾਤੇ ਦੀ ਬਕਾਇਆ ਰਕਮ ਹਾਲੇ ਤੱਕ ਹੱਲ ਨਹੀਂ ਹੋਈ। ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਸੁਚਨਾ ਨੂੰ ਗੰਭੀਰਤਾ ਨਾਲ ਲਓ ਅਤੇ ਵਾਪਸੀ ਦੇ ਵਿਕਲਪਾਂ ਬਾਰੇ ਗੱਲ ਕਰਨ ਲਈ ਤੁਰੰਤ ਸਾਡੇ ਦਫ਼ਤਰ ਨਾਲ ਸੰਪਰਕ ਕਰੋ। ਸਮੇਂ ਸਿਰ ਜਵਾਬ ਦੇਣ ਨਾਲ ਅਗਲੀ ਕਾਰਵਾਈ ਤੋਂ ਬਚਣ ਵਿੱਚ ਮਦਦ ਮਿਲ ਸਕਦੀ ਹੈ। ਧੰਨਵਾਦ।`,
    female: `ਨਮਸਤੇ। ਮੈਂ ਸਾਡੀ ਟੀਮ ਵਲੋਂ ਤੁਹਾਡੇ ਖਾਤੇ ਬਾਰੇ ਇੱਕ ਮਹੱਤਵਪੂਰਨ ਰਸਮੀ ਸੂਚਨਾ ਸਾਂਝੀ ਕਰ ਰਹੀ ਹਾਂ। ਸਾਡੇ ਰਿਕਾਰਡ ਅਨੁਸਾਰ ਤੁਹਾਡੇ ਖਾਤੇ ਦੀ ਬਕਾਇਆ ਰਕਮ ਹਾਲੇ ਤੱਕ ਹੱਲ ਨਹੀਂ ਹੋਈ। ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਸੁਚਨਾ ਨੂੰ ਗੰਭੀਰਤਾ ਨਾਲ ਲਓ ਅਤੇ ਵਾਪਸੀ ਦੇ ਵਿਕਲਪਾਂ ਬਾਰੇ ਗੱਲ ਕਰਨ ਲਈ ਤੁਰੰਤ ਸਾਡੇ ਦਫ਼ਤਰ ਨਾਲ ਸੰਪਰਕ ਕਰੋ। ਸਮੇਂ ਸਿਰ ਜਵਾਬ ਦੇਣ ਨਾਲ ਅਗਲੀ ਕਾਰਵਾਈ ਤੋਂ ਬਚਣ ਵਿੱਚ ਮਦਦ ਮਿਲ ਸਕਦੀ ਹੈ। ਧੰਨਵਾਦ।`
  }
};

export function getDefaultAvatarScript(
  language: string, 
  gender: "male" | "female" | null = "female",
  variety: "personalized" | "universal" = "universal"
): string {
  const resolvedGender = resolveNarratorGender(gender);
  if (variety === "universal") {
    const val = UNIVERSAL_TEMPLATES[language] ?? UNIVERSAL_TEMPLATES.English;
    return getGenderedText(val, resolvedGender);
  }
  
  const val = REMOTION_TEMPLATES[language] ?? REMOTION_TEMPLATES.English;
  return getGenderedText(val, resolvedGender);
}

export type TemplateBuilder = (speakerName: string, gender: "male" | "female") => string;

export const AVATAR_TEMPLATE_BUILDERS: Record<string, TemplateBuilder> = {
  English: (name) => `Hello. I am ${name}. I am calling to discuss your account.`,
  Hindi: (name, gender) => {
    const resolved = resolveNarratorGender(gender);
    return resolved === "male" 
      ? `नमस्ते। मैं ${name} बोल रहा हूँ। मैं आपके खाते के बारे में बात करने के लिए कॉल कर रहा हूँ।`
      : `नमस्ते। मैं ${name} बोल रही हूँ। मैं आपके खाते के बारे में बात करने के लिए कॉल कर रही हूँ।`;
  },
  Marathi: (name) => `नमस्कार. मी ${name} बोलत आहे. मी तुमच्या खात्याबद्दल बोलण्यासाठी कॉल करत आहे.`,
  Tamil: (name) => `வணக்கம். நான் ${name} பேசுகிறேன். உங்கள் கணக்கு பற்றி பேச நான் அழைக்கிறேன்.`,
  Telugu: (name) => `నమస్కారం. నేను ${name} మాట్లాడుతున్నాను. మీ ఖాతా గురించి మాట్లాడటానికి నేను కాల్ చేస్తున్నాను.`,
  Kannada: (name) => `ನಮಸ್ಕಾರ. ನಾನು ${name} ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ. ನಿಮ್ಮ ಖಾತೆಯ ಬಗ್ಗೆ ಮಾತನಾಡಲು ನಾನು ಕರೆ ಮಾಡುತ್ತಿದ್ದೇನೆ.`,
  Bengali: (name) => `নমস্কার। আমি ${name} বলছি। আমি আপনার অ্যাকাউন্ট নিয়ে কথা বলার জন্য ফোন করছি।`,
  Gujarati: (name, gender) => {
    const resolved = resolveNarratorGender(gender);
    return resolved === "male"
      ? `નમસ્તે. હું ${name} બોલી રહ્યો છું. હું તમારા ખાતા વિશે વાત કરવા માટે કોલ કરી રહ્યો છું.`
      : `નમસ્તે. હું ${name} બોલી રહી છું. હું તમારા ખાતા વિશે વાત કરવા માટે કોલ કરી રહી છું.`;
  },
  Malayalam: (name) => `നമസ്കാരം. ഞാൻ ${name} സംസാരിക്കുന്നു. നിങ്ങളുടെ અക്കൗണ്ടിനെക്കുറിച്ച് സംസാരിക്കാനാണ് ഞാൻ വിളിക്കുന്നത്.`,
  Punjabi: (name, gender) => {
    const resolved = resolveNarratorGender(gender);
    return resolved === "male"
      ? `ਨਮਸਤੇ। ਮੈਂ ${name} ਬੋਲ ਰਿਹਾ ਹਾਂ। ਮੈਂ ਤੁਹਾਡੇ ਖਾਤੇ ਬਾਰੇ ਗੱਲ ਕਰਨ ਲਈ ਫ਼ੋਨ ਕਰ ਰਿਹਾ ਹਾਂ।`
      : `ਨਮਸਤੇ। ਮੈਂ ${name} ਬੋਲ ਰਹੀ ਹਾਂ। ਮੈਂ ਤੁਹਾਡੇ ਖਾਤੇ ਬਾਰੇ ਗੱਲ ਕਰਨ ਲਈ ਫ਼ੋਨ ਕਰ ਰਹੀ ਹਾਂ।`;
  },
};

export const AVATAR_TEMPLATES: Record<string, string> = Object.fromEntries(
  Object.keys(AVATAR_TEMPLATE_BUILDERS).map((language) => [language, getDefaultAvatarScript(language, "female")]),
);

export const REMOTION_SUPPORTED_LANGUAGES = Object.keys(REMOTION_TEMPLATES).filter((l) => l !== "Punjabi");

export function getDefaultRemotionTranscript(
  language: string,
  mode: "personalized" | "universal" = "personalized",
  gender: "male" | "female" | null = "female",
  templateKey: RemotionTemplateKey = "account_notice",
): string {
  const resolvedGender = resolveNarratorGender(gender);
  if (mode === "personalized" && templateKey === "payment_guidance") {
    const val = PAYMENT_GUIDANCE_TEMPLATES[language] ?? PAYMENT_GUIDANCE_TEMPLATES.English;
    return getGenderedText(val, resolvedGender);
  }
  if (mode === "universal") {
    const val = UNIVERSAL_TEMPLATES[language] ?? UNIVERSAL_TEMPLATES.English;
    return getGenderedText(val, resolvedGender);
  }
  const val = REMOTION_TEMPLATES[language] ?? REMOTION_TEMPLATES.English;
  return getGenderedText(val, resolvedGender);
}
