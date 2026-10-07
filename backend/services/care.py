"""
A gentle safety net. If a student's situation suggests they may be thinking about
hurting themselves, the app shows a helpline alongside (not instead of) the reel.
"""

import re

_SIGNS = [
    r"suicid", r"kill (my ?self|me)", r"end (my|it) (life|all)", r"want to die", r"wanna die",
    r"self[- ]?harm", r"hurt(ing)? myself", r"cut(ting)? myself", r"no reason to live", r"better off dead",
    r"khudkushi", r"marna chahta", r"marna chahti", r"jeena nahi chahta", r"jeena nahi chahti",
    r"आत्महत्या", r"मरना चाहत", r"जीना नहीं चाहत", r"আত্মহত্যা", r"தற்கொலை",
]
_PATTERN = re.compile("|".join(_SIGNS), re.IGNORECASE)

CARE = {
    "title": "You don't have to carry this alone.",
    "message": "If you are thinking about hurting yourself, please talk to someone right now. "
               "Tele-MANAS is free, confidential and available 24x7 in many Indian languages.",
    "helplines": [
        {"name": "Tele-MANAS (Govt. of India)", "number": "14416"},
        {"name": "Tele-MANAS (toll-free)", "number": "1-800-891-4416"},
    ],
}


def care_check(text: str):
    return CARE if text and _PATTERN.search(text) else None
