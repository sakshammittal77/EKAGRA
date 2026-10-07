"""
Fallback script lines, used when Gemini is not configured or fails.

Grouped by the feeling a quote speaks to, in the four app languages. These are OUR words
(hook, situation, action, outro). His words are never stored here: the quote is always
inserted from quotes_library.py by the caller.
"""

import random
from typing import Dict, List

# Which template group fits each quote theme in quotes_library.py
GROUP_FOR_THEME = {
    "courage": "fear", "strength": "fear",
    "self-confidence": "doubt", "failure": "doubt",
    "concentration": "focus", "thoughts": "focus", "calm": "focus", "goal": "focus",
    "education": "learning", "character": "learning",
    "service": "purpose", "work": "purpose",
}

QUOTE_INTRO = {
    "en": "Swami Vivekananda said:",
    "hi": "स्वामी विवेकानंद ने कहा था:",
    "bn": "স্বামী বিবেকানন্দ বলেছিলেন:",
    "ta": "சுவாமி விவேகானந்தர் கூறினார்:",
}

OUTRO = {
    "en": "Save this, and share it with a friend who needs it today.",
    "hi": "इसे सेव करें, और उस दोस्त के साथ शेयर करें जिसे आज इसकी ज़रूरत है।",
    "bn": "এটা সেভ করো, আর সেই বন্ধুর সঙ্গে শেয়ার করো যার আজ এটা দরকার।",
    "ta": "இதைச் சேமித்து, இன்று இது தேவைப்படும் நண்பருடன் பகிர்.",
}

# group -> lang -> {hooks, suffix, action, screen: [hook, situation, action, outro]}
LINES: Dict[str, Dict[str, dict]] = {
    "fear": {
        "en": {
            "hooks": ["What if the fear is louder than you, but not stronger?",
                      "Your heart is racing. Good. That means it matters.",
                      "Ever wanted to run the moment pressure hits?"],
            "suffix": "Palms sweating, heart racing, every part of you looking for an exit.",
            "action": "Before you begin, take three slow breaths, then say the first sentence out loud. Just the first one.",
            "screen": ["Fear is loud", "The moment before", "3 breaths. 1 sentence.", "Face it today"],
        },
        "hi": {
            "hooks": ["क्या डर आपकी आवाज़ से ज़्यादा तेज़ है?",
                      "दिल तेज़ धड़क रहा है? मतलब ये ज़रूरी है।",
                      "दबाव आते ही भाग जाने का मन करता है?"],
            "suffix": "हथेलियाँ पसीने से भीगी, दिल तेज़, और मन बस बाहर निकलने का रास्ता ढूँढ रहा है।",
            "action": "शुरू करने से पहले तीन धीमी साँसें लें, फिर पहला वाक्य ज़ोर से बोलें। बस पहला।",
            "screen": ["डर शोर करता है", "उस पल से पहले", "3 साँसें। 1 वाक्य।", "आज सामना करें"],
        },
        "bn": {
            "hooks": ["ভয় কি তোমার কণ্ঠের চেয়েও জোরে?",
                      "বুক ধড়ফড় করছে? মানে এটা তোমার কাছে গুরুত্বপূর্ণ।",
                      "চাপ এলেই পালাতে ইচ্ছে করে?"],
            "suffix": "হাত ঘামছে, বুক ধড়ফড় করছে, মন শুধু পালানোর পথ খুঁজছে।",
            "action": "শুরু করার আগে তিনবার ধীরে শ্বাস নাও, তারপর প্রথম বাক্যটা জোরে বলো। শুধু প্রথমটা।",
            "screen": ["ভয় শব্দ করে", "ঠিক তার আগের মুহূর্ত", "৩টি শ্বাস। ১টি বাক্য।", "আজই মুখোমুখি হও"],
        },
        "ta": {
            "hooks": ["பயம் உன் குரலை விட சத்தமாக இருக்கிறதா?",
                      "இதயம் வேகமாகத் துடிக்கிறதா? அப்படியென்றால் இது முக்கியம்.",
                      "அழுத்தம் வந்தவுடன் ஓடிவிடத் தோன்றுகிறதா?"],
            "suffix": "கைகள் வியர்க்கின்றன, இதயம் படபடக்கிறது, மனம் தப்பிக்க வழி தேடுகிறது.",
            "action": "தொடங்கும் முன் மூன்று முறை மெதுவாக மூச்சு விடு, பிறகு முதல் வாக்கியத்தை சத்தமாகச் சொல். முதல் வாக்கியம் மட்டும்.",
            "screen": ["பயம் சத்தமிடும்", "அந்தத் தருணத்திற்கு முன்", "3 மூச்சு. 1 வாக்கியம்.", "இன்றே எதிர்கொள்"],
        },
    },
    "doubt": {
        "en": {
            "hooks": ["Everyone looks smarter than you. Are they, really?",
                      "That voice saying you're not enough. Let's talk about it.",
                      "Comparing yourself again today?"],
            "suffix": "You scroll, you compare, and you quietly decide you are behind.",
            "action": "Write down one thing you did well this week. Read it once before you sleep.",
            "screen": ["Not enough?", "The comparison trap", "Write one win", "Believe in yourself"],
        },
        "hi": {
            "hooks": ["सब आपसे ज़्यादा होशियार लगते हैं? सच में?",
                      "वो आवाज़ जो कहती है आप काफ़ी नहीं हैं, उसकी बात करते हैं।",
                      "आज फिर खुद की तुलना कर रहे हैं?"],
            "suffix": "आप स्क्रॉल करते हैं, तुलना करते हैं, और चुपचाप मान लेते हैं कि आप पीछे हैं।",
            "action": "इस हफ़्ते आपने जो एक काम अच्छा किया, उसे लिखें। सोने से पहले एक बार पढ़ें।",
            "screen": ["काफ़ी नहीं?", "तुलना का जाल", "एक जीत लिखें", "खुद पर भरोसा करें"],
        },
        "bn": {
            "hooks": ["সবাইকে তোমার চেয়ে বুদ্ধিমান মনে হয়? সত্যিই?",
                      "যে কণ্ঠ বলে তুমি যথেষ্ট নও, চলো তার কথা বলি।",
                      "আজও নিজেকে অন্যের সঙ্গে তুলনা করছ?"],
            "suffix": "তুমি স্ক্রল করো, তুলনা করো, আর চুপচাপ ধরে নাও তুমি পিছিয়ে আছ।",
            "action": "এই সপ্তাহে তুমি ভালো করেছ এমন একটা কাজ লিখে রাখো। ঘুমানোর আগে একবার পড়ো।",
            "screen": ["যথেষ্ট নও?", "তুলনার ফাঁদ", "একটা জয় লেখো", "নিজের উপর বিশ্বাস রাখো"],
        },
        "ta": {
            "hooks": ["எல்லோரும் உன்னை விட புத்திசாலியாகத் தெரிகிறார்களா? உண்மையிலா?",
                      "நீ போதாது என்று சொல்லும் அந்தக் குரல், அதைப் பற்றிப் பேசலாம்.",
                      "இன்றும் உன்னை மற்றவர்களோடு ஒப்பிடுகிறாயா?"],
            "suffix": "ஸ்க்ரோல் செய்கிறாய், ஒப்பிடுகிறாய், நீ பின்தங்கிவிட்டதாக அமைதியாக முடிவு செய்கிறாய்.",
            "action": "இந்த வாரம் நீ நன்றாகச் செய்த ஒரு விஷயத்தை எழுது. தூங்கும் முன் ஒருமுறை படி.",
            "screen": ["போதாதா?", "ஒப்பீட்டுப் பொறி", "ஒரு வெற்றியை எழுது", "உன்னை நம்பு"],
        },
    },
    "focus": {
        "en": {
            "hooks": ["You opened your books 40 minutes ago. How much did you read?",
                      "Your phone buzzed. Your focus left.",
                      "Why can't the mind just stay?"],
            "suffix": "One notification, then another, and the hour is gone.",
            "action": "Put your phone in another room and set a 25-minute timer. One task, nothing else.",
            "screen": ["Where did it go?", "Distracted again", "25 minutes. One task.", "One-pointed mind"],
        },
        "hi": {
            "hooks": ["किताब 40 मिनट पहले खोली थी। कितना पढ़ा?",
                      "फ़ोन बजा, और ध्यान चला गया।",
                      "मन टिकता क्यों नहीं?"],
            "suffix": "एक नोटिफ़िकेशन, फिर दूसरा, और पूरा घंटा निकल गया।",
            "action": "फ़ोन दूसरे कमरे में रखें और 25 मिनट का टाइमर लगाएँ। एक काम, और कुछ नहीं।",
            "screen": ["ध्यान कहाँ गया?", "फिर से भटके", "25 मिनट। एक काम।", "एकाग्र मन"],
        },
        "bn": {
            "hooks": ["৪০ মিনিট আগে বই খুলেছিলে। কতটা পড়লে?",
                      "ফোন বাজল, আর মনোযোগ চলে গেল।",
                      "মন কেন এক জায়গায় থাকে না?"],
            "suffix": "একটা নোটিফিকেশন, তারপর আরেকটা, আর পুরো ঘণ্টা চলে গেল।",
            "action": "ফোনটা অন্য ঘরে রাখো আর ২৫ মিনিটের টাইমার দাও। একটা কাজ, আর কিছু না।",
            "screen": ["মন কোথায় গেল?", "আবার অমনোযোগী", "২৫ মিনিট। একটা কাজ।", "একাগ্র মন"],
        },
        "ta": {
            "hooks": ["40 நிமிடங்களுக்கு முன் புத்தகத்தைத் திறந்தாய். எவ்வளவு படித்தாய்?",
                      "போன் ஒலித்தது, கவனம் போய்விட்டது.",
                      "மனம் ஏன் ஓரிடத்தில் நிற்பதில்லை?"],
            "suffix": "ஒரு அறிவிப்பு, பிறகு இன்னொன்று, ஒரு மணி நேரம் போய்விட்டது.",
            "action": "போனை வேறு அறையில் வைத்து 25 நிமிட டைமர் வை. ஒரே வேலை, வேறு எதுவும் இல்லை.",
            "screen": ["கவனம் எங்கே?", "மீண்டும் சிதறல்", "25 நிமிடம். ஒரே வேலை.", "ஒருமுகப்பட்ட மனம்"],
        },
    },
    "learning": {
        "en": {
            "hooks": ["Studying only for marks feels empty, doesn't it?",
                      "What if school was never about the exam?",
                      "Memorise, write, forget. Repeat?"],
            "suffix": "The syllabus is long, and the meaning feels far away.",
            "action": "Pick one topic from today and explain it to a friend in your own words.",
            "screen": ["Only for marks?", "The rote routine", "Teach one idea", "Learn to grow"],
        },
        "hi": {
            "hooks": ["सिर्फ़ नंबरों के लिए पढ़ना खोखला लगता है, है ना?",
                      "क्या पढ़ाई सच में सिर्फ़ परीक्षा के लिए है?",
                      "रटो, लिखो, भूल जाओ। फिर से?"],
            "suffix": "सिलेबस लंबा है, और उसका मतलब कहीं दूर लगता है।",
            "action": "आज का एक टॉपिक चुनें और उसे अपने शब्दों में किसी दोस्त को समझाएँ।",
            "screen": ["सिर्फ़ नंबर?", "रटने की आदत", "एक बात सिखाएँ", "बढ़ने के लिए सीखें"],
        },
        "bn": {
            "hooks": ["শুধু নম্বরের জন্য পড়াটা ফাঁকা লাগে, তাই না?",
                      "পড়াশোনা কি সত্যিই শুধু পরীক্ষার জন্য?",
                      "মুখস্থ করো, লেখো, ভুলে যাও। আবার?"],
            "suffix": "সিলেবাস লম্বা, আর তার মানেটা অনেক দূরে মনে হয়।",
            "action": "আজকের একটা বিষয় বেছে নাও আর নিজের ভাষায় একজন বন্ধুকে বুঝিয়ে বলো।",
            "screen": ["শুধু নম্বর?", "মুখস্থের অভ্যাস", "একটা ভাবনা শেখাও", "বড় হতে শেখো"],
        },
        "ta": {
            "hooks": ["மதிப்பெண்ணுக்காக மட்டும் படிப்பது வெறுமையாக இருக்கிறது, இல்லையா?",
                      "படிப்பு உண்மையில் தேர்வுக்காக மட்டும்தானா?",
                      "மனப்பாடம், எழுது, மற. மீண்டும்?"],
            "suffix": "பாடத்திட்டம் நீளமானது, அதன் அர்த்தம் தொலைவில் தெரிகிறது.",
            "action": "இன்றைய ஒரு பாடத்தைத் தேர்ந்தெடுத்து உன் சொந்த வார்த்தைகளில் ஒரு நண்பருக்கு விளக்கு.",
            "screen": ["மதிப்பெண் மட்டுமா?", "மனப்பாட வழக்கம்", "ஒரு கருத்தைக் கற்பி", "வளர கற்றுக்கொள்"],
        },
    },
    "purpose": {
        "en": {
            "hooks": ["Ever felt your life should mean something more?",
                      "Busy all day, but for what?",
                      "What if helping one person changed you too?"],
            "suffix": "Days pass in a loop, and something inside asks: is this all?",
            "action": "Today, do one small thing for someone without telling anyone.",
            "screen": ["Is this all?", "Stuck in the loop", "One quiet help", "Serve and grow"],
        },
        "hi": {
            "hooks": ["कभी लगा कि ज़िंदगी का कोई बड़ा मतलब होना चाहिए?",
                      "दिन भर व्यस्त, पर किसलिए?",
                      "किसी एक की मदद आपको भी बदल दे तो?"],
            "suffix": "दिन एक जैसे गुज़रते हैं, और भीतर से आवाज़ आती है: क्या बस इतना ही?",
            "action": "आज किसी के लिए एक छोटा काम करें, बिना किसी को बताए।",
            "screen": ["बस इतना ही?", "एक ही चक्र", "एक चुपचाप मदद", "सेवा करें, बढ़ें"],
        },
        "bn": {
            "hooks": ["কখনও মনে হয়েছে জীবনের আরও বড় কোনো মানে থাকা উচিত?",
                      "সারাদিন ব্যস্ত, কিন্তু কীসের জন্য?",
                      "একজনকে সাহায্য করা যদি তোমাকেও বদলে দেয়?"],
            "suffix": "দিনগুলো একইভাবে কেটে যায়, আর ভেতর থেকে প্রশ্ন আসে: এটুকুই কি সব?",
            "action": "আজ কারও জন্য একটা ছোট কাজ করো, কাউকে না জানিয়ে।",
            "screen": ["এটুকুই সব?", "একই চক্রে আটকে", "একটা নীরব সাহায্য", "সেবা করো, বড় হও"],
        },
        "ta": {
            "hooks": ["வாழ்க்கைக்கு இன்னும் பெரிய அர்த்தம் வேண்டும் என்று தோன்றியதுண்டா?",
                      "நாள் முழுவதும் பரபரப்பு, ஆனால் எதற்காக?",
                      "ஒருவருக்கு உதவுவது உன்னையும் மாற்றினால்?"],
            "suffix": "நாட்கள் ஒரே மாதிரி கடக்கின்றன, உள்ளே ஒரு கேள்வி: இவ்வளவுதானா?",
            "action": "இன்று யாருக்காவது ஒரு சிறிய உதவி செய், யாரிடமும் சொல்லாமல்.",
            "screen": ["இவ்வளவுதானா?", "ஒரே சுழற்சி", "ஒரு அமைதியான உதவி", "சேவை செய், வளர்"],
        },
    },
}

VISUALS = {
    "fear": ["Tight close-up: hands trembling over a phone, fast cuts", "A student waiting outside a classroom door, shallow focus",
             "Slow push-in on the quote over saffron light, source badge on screen", "Student stepping up to the front, steady breath",
             "Wide calm shot, student smiling after speaking"],
    "doubt": ["Split screen: endless feed of other people's highlights", "Student alone at a desk, comparing a marksheet",
              "Quote revealed word by word over a dark background, source badge", "Hand writing one line in a notebook",
              "Mirror shot, student nodding at their reflection"],
    "focus": ["Phone notifications stacking up over an open textbook", "Clock time-lapse while the student keeps switching apps",
              "Single candle flame, quote fades in, source badge", "Phone placed in another room, timer starting at 25:00",
              "Calm desk, one book, one pen"],
    "learning": ["Fast montage of highlighters, flashcards and exam dates", "Student yawning over a thick guide book",
                 "Quote over old library shelves, source badge", "Two friends at a table, one explaining with hand gestures",
                 "Student closing the book with a smile"],
    "purpose": ["Same daily routine shown in a fast loop", "Student staring out of a bus window",
                "Quote over a sunrise, source badge", "Small act of help: carrying someone's bags, sharing notes",
                "Warm wide shot of people together"],
}


def group_for(themes: List[str]) -> str:
    for t in themes or []:
        if t in GROUP_FOR_THEME:
            return GROUP_FOR_THEME[t]
    return "fear"


def lines_for(themes: List[str], language: str) -> dict:
    group = group_for(themes)
    lang = language if language in QUOTE_INTRO else "en"
    return {"group": group, "lang": lang, **LINES[group][lang],
            "intro": QUOTE_INTRO[lang], "outro": OUTRO[lang], "visuals": VISUALS[group]}


def pick_hook(themes: List[str], language: str, seed: str = "") -> str:
    hooks = lines_for(themes, language)["hooks"]
    return random.Random(seed).choice(hooks) if seed else random.choice(hooks)
