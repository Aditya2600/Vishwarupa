export type Gender = "male" | "female";

export function resolveNarratorGender(gender: "male" | "female" | null): Gender {
  return gender === "male" ? "male" : "female";
}

interface GenderedTemplate {
  male: string;
  female: string;
}

type TemplateValue = string | GenderedTemplate;
export type RemotionTemplateKey =
  | "account_notice"
  | "payment_guidance"
  | "payment_link_guidance"
  | "overdue_template"
  | "loan_offer_interactive"
  | "loan_reminder"
  | "scene_loan_offer"
  | "collection_reminder"
  | "tvs_credit_emi";
export type CreateMode = "avatar" | "remotion" | "hybrid_remotion_avatar_pip";
export type LoanReminderAssetKey =
  | "logo"
  | "npaWarning"
  | "creditImpact"
  | "lastChance"
  | "ctaScene"
  | "financialBurden";

export type LoanReminderAssetPaths = Record<LoanReminderAssetKey, string>;

export const LOAN_REMINDER_ASSET_SLOTS: Array<{
  key: LoanReminderAssetKey;
  label: string;
  defaultPath: string;
}> = [
  { key: "logo", label: "Logo", defaultPath: "assets/tvs_credit_logo.png" },
  { key: "npaWarning", label: "NPA Warning", defaultPath: "man_phone_transparent.png" },
  { key: "creditImpact", label: "Credit Impact", defaultPath: "credit_score_transparent.png" },
  { key: "lastChance", label: "Last Chance", defaultPath: "last_chance_transparent.png" },
  { key: "ctaScene", label: "CTA Scene", defaultPath: "phone_paynow_transparent.png" },
  { key: "financialBurden", label: "Financial Burden", defaultPath: "piggy_bank_arrow_transparent.png" },
];

export const DEFAULT_LOAN_REMINDER_ASSET_PATHS: LoanReminderAssetPaths = Object.fromEntries(
  LOAN_REMINDER_ASSET_SLOTS.map((slot) => [slot.key, slot.defaultPath]),
) as LoanReminderAssetPaths;

const LOAN_REMINDER_TRANSCRIPT = `Yeh ek important reminder hai {{ client_name }} ki taraf se.
Dear {{ customer_name }}, aapke {{ product_type }} account number {{ lan }} par {{ tos }} ka overdue amount pending hai.
Kripya dhyaan dein, agar payment aur delay hoti hai, toh aapka account critically overdue category mein ja sakta hai, ya applicable policy ke according NPA report ho sakta hai.
Iska negative impact aapke credit score par pad sakta hai, aur future loan approval, credit card eligibility, aur financial services access affect ho sakte hain.
Lender policy ke according recovery action initiate ho sakta hai, legal notice issue ho sakta hai, aur additional charges bhi badh sakte hain.
Further financial burden avoid karne ke liye, kripya apna overdue amount jald se jald clear karein.
Aap apne overdue amount ko secure repayment channel ke through clear kar sakte hain. Zarurat ho toh assistance ke liye support team se sampark karein.
Additional charges avoid karein, aur apni financial profile protect karne ke liye aaj hi dues clear karein.
Dhanyavaad.`;

const COLLECTION_REMINDER_TRANSCRIPT = `Dear {{ customer_name }},
Your {{ product_type }} ending with {{ lan }} has an overdue amount of {{ tos }}.
If this continues beyond 90 days, your account will be classified as a Non-Performing Asset, NPA.
Non-payment can lead to legal action to recover dues, restrictions on future loans or credit cards from any financial institution, and a lasting negative impact on your financial health.
Take action now. Clear your outstanding balance and avoid these consequences.
Timely repayment brings several benefits. Protect your credit score and ensure access to future loans.
We understand that life can be challenging. If full repayment is difficult, here are some options for you. Pay the minimum amount due.
Act now to protect your financial future.
You can call your {{ client_name }} banker at {{ contact_details }} for assistance.
Our team is here to guide you. Thank you for choosing {{ client_name }}.
Contact us today, and let's work together for a solution.`;
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

export const PAYMENT_LINK_GUIDANCE_TEMPLATES: Record<string, TemplateValue> = {
  English: `Welcome {{ customer_name }}.
This video will guide you through completing payment from the payment link.
First, enter your agreement number and captcha exactly as shown.
Next, accept the terms and review the payable amount for account {{ lan }}.
Then tap proceed to pay and choose your preferred payment method.
For support, please contact {{ contact_details }}.
Thank you.`,
  Hindi: {
    male: `नमस्ते {{ customer_name }}। सब से पहले SMS में दिए गए लिंक पर क्लिक करें। इसके बाद अपना एग्रीमेंट नंबर और कैप्चा ठीक से दर्ज करें। फिर नियम और शर्तें स्वीकार करें और अपनी राशि जांचें। इसके बाद आगे बढ़ने के लिए Proceed to Pay पर टैप करें और अपनी पसंद का भुगतान तरीका चुनें। सहायता के लिए कृपया {{ contact_details }} पर संपर्क करें। धन्यवाद।`,
    female: `नमस्ते {{ customer_name }}। सब se pehle SMS mein diye gaye link par click karein. Iske baad apna agreement number aur captcha thik se darj karein. Phir niyam aur shartein swikar karein aur apni rashi jaanchein. Iske baad aage badhne ke liye Proceed to Pay par tap karein aur apni pasand ka bhugtan tareeka chunein. Sahayata ke liye kripya {{ contact_details }} par sampark karein. Dhanyawad.`,
  },
};

export const TVS_CREDIT_EMI_TEMPLATES: Record<string, TemplateValue> = {
  English: `Hello {{ customer_name }}. Regarding your {{ product_type }} account from {{ client_name }}. An EMI amount of ₹{{ tos }} is pending on account {{ lan }}. For your convenience, below are 3 easy ways to make your EMI payment.
Method 1 — Payment via Payment Link. A secure link has been sent to you on WhatsApp. You can also find the payment link shared via SMS.
Method 2 — Payment through UPI or Payment Apps. Pay conveniently using PhonePe, Google Pay, or any UPI app. Go to Repayment, search for TVS Credit, and enter your LAN. Complete the payment using your UPI PIN. Wait for the successful payment confirmation.
Method 3 — EMI Collection Shop. Visit your nearest EMI Collection Shop to deposit your EMI amount.
Please treat this communication as important and contact {{ contact_details }} immediately to discuss options and avoid charges.`,
  Hindi: {
    male: `नमस्ते {{ customer_name }}। आपके {{ client_name }} के {{ product_type }} खाते के संबंध में। आपके {{ lan }} खाते पर {{ tos }} रुपये की EMI राशि लंबित है। आपकी सुविधा के लिए, EMI भुगतान करने के 3 आसान तरीके नीचे दिए गए हैं।
Method 1 - पेमेंट लिंक के माध्यम से भुगतान। व्हाट्सएप पर आपको एक सुरक्षित लिंक भेजा गया है। आप एसएमएस के माध्यम से साझा किया गया भुगतान लिंक भी पा सकते हैं।
Method 2 - UPI या पेमेंट ऐप के माध्यम से भुगतान। PhonePe, Google Pay या किसी भी UPI ऐप का उपयोग करके आसानी से भुगतान करें। पुनर्भुगतान (Repayment) पर जाएं, TVS Credit खोजें, और अपना LAN दर्ज करें। अपने UPI पिन का उपयोग करके भुगतान पूरा करें। सफल भुगतान की पुष्टि की प्रतीक्षा करें।
Method 3 - EMI कलेक्शन शॉप। अपनी EMI राशि जमा करने के लिए अपने नजदीकी EMI कलेक्शन शॉप पर जाएं।
विकल्पों पर चर्चा करने और अतिरिक्त शुल्क से बचने के लिए तुरंत {{ contact_details }} पर संपर्क करें।`,
    female: `नमस्ते {{ customer_name }}। आपके {{ client_name }} के {{ product_type }} खाते के संबंध में। आपके {{ lan }} खाते पर {{ tos }} रुपये की EMI राशि लंबित है। आपकी सुविधा के लिए, EMI भुगतान करने के 3 आसान तरीके नीचे दिए गए हैं।
Method 1 - पेमेंट लिंक के माध्यम से भुगतान। व्हाट्सएप पर आपको एक सुरक्षित लिंक भेजा गया है। आप एसएमएस के माध्यम से साझा किया गया भुगतान लिंक भी पा सकते हैं।
Method 2 - UPI या पेमेंट ऐप के माध्यम से भुगतान। PhonePe, Google Pay या किसी भी UPI ऐप का उपयोग करके आसानी से भुगतान करें। पुनर्भुगतान (Repayment) पर जाएं, TVS Credit खोजें, और अपना LAN दर्ज करें। अपने UPI पिन का उपयोग करके भुगतान पूरा करें। सफल भुगतान की पुष्टि की प्रतीक्षा करें।
Method 3 - EMI कलेक्शन शॉप। अपनी EMI राशि जमा करने के लिए अपने नजदीकी EMI कलेक्शन शॉप पर जाएं।
विकल्पों पर चर्चा करने और अतिरिक्त शुल्क से बचने के लिए तुरंत {{ contact_details }} पर संपर्क करें।`,
  }
};

export const TVS_CREDIT_EMI_UNIVERSAL_TEMPLATES: Record<string, TemplateValue> = {
  English: `Hello. Regarding your account from our team. An outstanding amount is pending on your account.
A secure link has been sent to you on WhatsApp.
You can also find the payment link shared via SMS.
Pay conveniently using PhonePe, Google Pay, or any UPI app.
Go to Repayment, search for TVS Credit, and enter your LAN.
Complete the payment using your UPI PIN.
Visit your nearest EMI Collection Shop to deposit your EMI amount.
Contact our team immediately to discuss options and avoid charges.`,
  Hindi: {
    male: `नमस्ते। हमारी टीम की ओर से आपके खाते के संबंध में। आपके खाते पर बकाया राशि लंबित है।
व्हाट्सएप पर आपको एक सुरक्षित लिंक भेजा गया है।
आप एसएमएस के माध्यम से साझा किया गया भुगतान लिंक भी पा सकते हैं।
PhonePe, Google Pay या किसी भी UPI ऐप का उपयोग करके आसानी से भुगतान करें।
पुनर्भुगतान (Repayment) पर जाएं, TVS Credit खोजें, और अपना LAN दर्ज करें।
अपने UPI पिन का उपयोग करके भुगतान पूरा करें।
अपनी EMI राशि जमा करने के लिए अपने नजदीकी EMI कलेक्शन शॉप पर जाएं।
विकल्पों पर चर्चा करने और अतिरिक्त शुल्क से बचने के लिए तुरंत हमारी टीम से संपर्क करें।`,
    female: `नमस्ते। हमारी टीम की ओर से आपके खाते के संबंध में। आपके खाते पर बकाया राशि लंबित है।
व्हाट्सएप पर आपको एक सुरक्षित लिंक भेजा गया है।
आप एसएमएस के माध्यम से साझा किया गया भुगतान लिंक भी पा सकते हैं।
PhonePe, Google Pay या किसी भी UPI ऐप का उपयोग करके आसानी से भुगतान करें।
पुनर्भुगतान (Repayment) पर जाएं, TVS Credit खोजें, और अपना LAN दर्ज करें।
अपने UPI पिन का उपयोग करके भुगतान पूरा करें।
अपनी EMI राशि जमा करने के लिए अपने नजदीकी EMI कलेक्शन शॉप पर जाएं।
विकल्पों पर चर्चा करने और अतिरिक्त शुल्क से बचने के लिए तुरंत हमारी टीम से संपर्क करें।`,
  }
};

export const OVERDUE_TEMPLATES: Record<string, TemplateValue> = {
  English: `Dear {{ customer_name }}. Your {{ client_name }} credit card ending with {{ lan }} has an overdue amount of {{ tos }}. If this continues beyond 90 days, your account will be classified as a Non-Performing Asset (NPA). Non-payment can lead to legal action to recover dues, restrictions on future loans or credit cards, and a lasting negative impact on your financial credibility. But you can take action now. Clear your outstanding balance and avoid these consequences. Timely repayment protects your credit score, ensures access to future loans, and avoids late fees or penalties. We understand that life can be challenging. If full repayment is difficult, you can pay the minimum amount due of {{ loan_amount }} or reach out for further assistance. Act now to protect your financial future. Call us at {{ contact_details }} for assistance. Thank you for choosing {{ client_name }}.`,
  Hindi: {
    male: `प्रिय {{ customer_name }}। आपके {{ client_name }} क्रेडिट कार्ड, जिसके अंत में {{ lan }} है, का बकाया भुगतान {{ tos }} है। यदि यह 90 दिनों से अधिक जारी रहता है, तो आपके खाते को NPA वर्गीकृत किया जाएगा। भुगतान न करने से कानूनी कार्रवाई हो सकती है, भविष्य के ऋणों या क्रेडिट कार्डों पर प्रतिबंध लग सकते हैं, और आपके क्रेडिट इतिहास पर बुरा प्रभाव पड़ सकता है। लेकिन आप अभी कदम उठा सकते हैं। अपना बकाया चुकाएं और इन परिणामों से बचें। समय पर भुगतान आपके क्रेडिट स्कोर को सुरक्षित रखता है, नए लोन सुनिश्चित करता है, और विलंब शुल्क या पेनल्टी से बचाता है। हम समझते हैं कि जीवन चुनौतीपूर्ण हो सकता है। यदि पूरा भुगतान कठिन है, तो आप न्यूनतम देय राशि {{ loan_amount }} का भुगतान कर सकते हैं या सहायता के लिए संपर्क कर सकते हैं। अपने वित्तीय भविष्य की सुरक्षा के लिए अभी कदम उठाएं। सहायता के लिए हमें {{ contact_details }} पर कॉल करें। {{ client_name }} को चुनने के लिए धन्यवाद।`,
    female: `प्रिय {{ customer_name }}। आपके {{ client_name }} क्रेडिट कार्ड, जिसके अंत में {{ lan }} है, का बकाया भुगतान {{ tos }} है। यदि यह 90 दिनों से अधिक जारी रहता है, तो आपके खाते को NPA वर्गीकृत किया जाएगा। भुगतान न करने से कानूनी कार्रवाई हो सकती है, भविष्य के ऋणों या क्रेडिट कार्डों पर प्रतिबंध लग सकते हैं, और आपके क्रेडिट इतिहास पर बुरा प्रभाव पड़ सकता. लेकिन आप अभी कदम उठा सकते हैं। अपना बकाया चुकाएं और इन परिणामों से बचें। समय पर भुगतान आपके क्रेडिट स्कोर को सुरक्षित रखता है, नए लोन सुनिश्चित करता है, और विलंब शुल्क या पेनल्टी से बचाता है। हम समझते हैं कि जीवन चुनौतीपूर्ण हो सकता है। यदि पूरा भुगतान कठिन है, तो आप न्यूनतम देय राशि {{ loan_amount }} का भुगतान कर सकते हैं या सहायता के लिए संपर्क कर सकते हैं। अपने वित्तीय भविष्य की सुरक्षा के लिए अभी कदम उठाएं। सहायता के लिए हमें {{ contact_details }} पर कॉल करें। {{ client_name }} को चुनने के लिए धन्यवाद।`,
  },
};

export const LOAN_OFFER_INTERACTIVE_TEMPLATES: Record<string, TemplateValue> = {
  English: `Congratulations {{ customer_name }}. You have a pre-approved loan offer from {{ client_name }} up to {{ loan_amount }}. Please tap Continue to view details.
Now, choose your preferred loan amount and tenure, and tap Confirm Loan Offer to submit.
Thank you. Your offer is confirmed, and our team will contact you shortly to complete the next steps. For help, you can call us now.`,
  Hindi: {
    male: `बधाई हो {{ customer_name }}। {{ client_name }} की ओर से आपके लिए {{ loan_amount }} तक का प्री-अप्रूव्ड लोन ऑफर उपलब्ध है। विवरण देखने के लिए कृपया Continue पर टैप करें।
अब, अपनी पसंद की लोन राशि और अवधि चुनें, और सबमिट करने के लिए कन्फर्म लोन ऑफर पर टैप करें।
धन्यवाद। आपका ऑफर कन्फर्म हो गया है, और हमारी टीम अगले कदम पूरे करने के लिए जल्द ही आपसे संपर्क करेगी। सहायता के लिए आप अभी हमें कॉल कर सकते हैं।`,
    female: `बधाई हो {{ customer_name }}। {{ client_name }} की ओर से आपके लिए {{ loan_amount }} तक का प्री-अप्रूव्ड लोन ऑफर उपलब्ध है। विवरण देखने के लिए कृपया Continue पर टैप करें।
अब, अपनी पसंद की लोन राशि और अवधि चुनें, और सबमिट करने के लिए कन्फर्म लोन ऑफर पर टैप करें।
धन्यवाद। आपका ऑफर कन्फर्म हो गया है, और हमारी टीम अगले कदम पूरे करने के लिए जल्द ही आपसे संपर्क करेगी। सहायता के लिए आप अभी हमें कॉल कर सकते हैं।`,
  },
};

export const SCENE_LOAN_OFFER_TRANSCRIPT = `पैसों की परेशानी से जूझ रहे हैं? अब चिंता छोड़िए।
बधाई हो! आपके लिए एक खास प्री-अप्रूव्ड लोन ऑफर तैयार है।
नया बाइक हो, ज़रूरी खर्च हो या आपके सपने, अब सब होगा आसान।
अपनी जरूरत के हिसाब से आसान लोन विकल्प चुनना अब और भी सरल है।
तेज़ प्रोसेस, कम दस्तावेज़ और भरोसेमंद सहायता।
हर कदम पर हमारी टीम आपके साथ है।
अपने सपनों को आगे बढ़ाइए और बेहतर कल की शुरुआत कीजिए।
आपका प्री-अप्रूव्ड ऑफर आपका इंतज़ार कर रहा है।`;

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
  {
    key: "payment_link_guidance",
    name: "Payment Link Guidance",
    description: "Screenshot-based guide for captcha, terms, amount review, and payment options.",
  },
  {
    key: "overdue_template",
    name: "Credit Card Overdue Notice",
    description: "Overdue alert sequence detailing NPA classification, credit score impact, and payment options.",
  },
  {
    key: "loan_offer_interactive",
    name: "Interactive Loan Offer",
    description: "Brand-editable loan offer with Continue, amount/tenure selection, EMI summary, and confirm CTA.",
  },
  {
    key: "scene_loan_offer",
    name: "Sales Template",
    description: "Image-led sales video using the five provided scenes.",
  },
  {
    key: "loan_reminder",
    name: "Loan Reminder",
    description: "Portrait loan reminder with scene-wise captions and configurable brand imagery.",
  },
  {
    key: "collection_reminder",
    name: "Collection Reminder",
    description: "Personalized collection reminder video with repayment details and contact CTA.",
  },
  {
    key: "tvs_credit_emi",
    name: "3 step payment guidance",
    description: "Comprehensive 3-step payment guidance walkthrough designed with custom app image uploads.",
  },
];

export const TEMPLATE_LIBRARY_QUICK_STARTS: Array<{
  mode: CreateMode;
  name: string;
  description: string;
  template?: RemotionTemplateKey;
  iconKey: "hybrid_avatar_pip" | RemotionTemplateKey | "avatar";
}> = [
  {
    mode: "hybrid_remotion_avatar_pip",
    name: "VisionDesk",
    description: "A newsroom-inspired visual background where AI presenters deliver information alongside contextual visuals, branded graphics, and animated supporting content.",
    iconKey: "hybrid_avatar_pip",
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
  if (mode === "personalized" && templateKey === "payment_link_guidance") {
    const val = PAYMENT_LINK_GUIDANCE_TEMPLATES[language] ?? PAYMENT_LINK_GUIDANCE_TEMPLATES.English;
    return getGenderedText(val, resolvedGender);
  }
  if (mode === "personalized" && templateKey === "overdue_template") {
    const val = OVERDUE_TEMPLATES[language] ?? OVERDUE_TEMPLATES.English;
    return getGenderedText(val, resolvedGender);
  }
  if (mode === "personalized" && templateKey === "tvs_credit_emi") {
    const val = TVS_CREDIT_EMI_TEMPLATES[language] ?? TVS_CREDIT_EMI_TEMPLATES.English;
    return getGenderedText(val, resolvedGender);
  }
  if (mode === "personalized" && templateKey === "loan_offer_interactive") {
    const val = LOAN_OFFER_INTERACTIVE_TEMPLATES[language] ?? LOAN_OFFER_INTERACTIVE_TEMPLATES.English;
    return getGenderedText(val, resolvedGender);
  }
  if (mode === "personalized" && templateKey === "scene_loan_offer") {
    return SCENE_LOAN_OFFER_TRANSCRIPT;
  }
  if (mode === "personalized" && templateKey === "loan_reminder") {
    return LOAN_REMINDER_TRANSCRIPT;
  }
  if (mode === "universal" && templateKey === "scene_loan_offer") {
    return SCENE_LOAN_OFFER_TRANSCRIPT;
  }
  if (mode === "universal" && templateKey === "tvs_credit_emi") {
    const val = TVS_CREDIT_EMI_UNIVERSAL_TEMPLATES[language] ?? TVS_CREDIT_EMI_UNIVERSAL_TEMPLATES.English;
    return getGenderedText(val, resolvedGender);
  }
  if (mode === "personalized" && templateKey === "collection_reminder") {
    return COLLECTION_REMINDER_TRANSCRIPT;
  }
  if (mode === "universal") {
    const val = UNIVERSAL_TEMPLATES[language] ?? UNIVERSAL_TEMPLATES.English;
    return getGenderedText(val, resolvedGender);
  }
  const val = REMOTION_TEMPLATES[language] ?? REMOTION_TEMPLATES.English;
  return getGenderedText(val, resolvedGender);
}
