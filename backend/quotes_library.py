"""
EKAGRA quote library: exact passages from The Complete Works of Swami Vivekananda.

RULES (do not break these):
- `text` is copied word for word from the chapter page in `url`
  (Advaita Ashrama edition, hosted by the Ramakrishna-Vivekananda Center of New York).
  Never shorten, join, translate or "improve" a passage here.
- The AI never writes these words. It may only choose a quote by its `id`;
  the code then inserts `text` and the source exactly as stored here.
- `python backend/scripts/verify_quotes.py` downloads every source page and fails
  if any passage is not found word for word. GitHub runs it on every change.

To add a quote: copy one contiguous run of complete sentences from a chapter page,
add an entry below with its url, then run the verify script.
"""

BOOK = "The Complete Works of Swami Vivekananda"
SITE = "https://www.ramakrishnavivekananda.info/vivekananda/"

QUOTES = [
    # ---------------- Fear / courage / strength ----------------
    {
        "id": "abhih_fearless",
        "text": "Strength, O man, strength, say the Upanishads, stand up and be strong. Ay, it is the only literature in the world where you find the word \"Abhih\", \"fearless\", used again and again; in no other scripture in the world is this adjective applied either to God or to man.",
        "themes": ["courage", "strength"],
        "situations": "Nervous before an exam, viva or presentation; needing to feel fearless",
        "volume": 3, "section": "Lectures from Colombo to Almora", "chapter": "Vedanta in its Application to Indian Life",
        "url": SITE + "volume_3/lectures_from_colombo_to_almora/vedanta_in_its_applications_to_indian_life.htm",
    },
    {
        "id": "dare_to_believe",
        "text": "Stand up, men and women, in this spirit, dare to believe in the Truth, dare to practice the Truth! The world requires a few hundred bold men and women.",
        "themes": ["courage"],
        "situations": "Afraid to speak up in class, pitch an idea or present in front of others",
        "volume": 2, "section": "Jnana-Yoga", "chapter": "The Real Nature of Man",
        "url": SITE + "volume_2/jnana-yoga/the_real_nature_of_man.htm",
    },
    {
        "id": "selfishness_fear",
        "text": "And because that nature is selfless, it is strong and fearless; for only to selfishness comes fear. He who has nothing to desire for himself, whom does he fear, and what can frighten him?",
        "themes": ["courage", "work"],
        "situations": "Anxiety about results, marks, placements or what others will think",
        "volume": 2, "section": "Practical Vedanta and other lectures", "chapter": "Practical Vedanta: Part IV",
        "url": SITE + "volume_2/practical_vedanta_and_other_lectures/practical_vedanta_part_iv.htm",
    },
    {
        "id": "arise_awake",
        "text": "Arise, awake, and stop not till the goal is reached. Arise, awake! Awake from this hypnotism of weakness. None is really weak; the soul is infinite, omnipotent, and omniscient. Stand up, assert yourself, proclaim the God within you, do not deny Him!",
        "themes": ["goal", "self-confidence", "strength"],
        "situations": "Feeling lazy, stuck or weak midway through preparation; procrastination; feeling 'not smart enough'",
        "volume": 3, "section": "Lectures from Colombo to Almora", "chapter": "The Mission of the Vedanta",
        "url": SITE + "volume_3/lectures_from_colombo_to_almora/the_mission_of_the_vedanta.htm",
    },
    {
        "id": "faith_in_yourselves",
        "text": "Have faith in yourselves, and stand up on that faith and be strong; that is what we need.",
        "themes": ["self-confidence", "strength"],
        "situations": "Self-doubt before an interview, competition or big test",
        "volume": 3, "section": "Lectures from Colombo to Almora", "chapter": "The Mission of the Vedanta",
        "url": SITE + "volume_3/lectures_from_colombo_to_almora/the_mission_of_the_vedanta.htm",
    },
    {
        "id": "do_not_say_weak",
        "text": "Do not say we are weak; we can do anything and everything. What can we not do? Everything can be done by us; we all have the same glorious soul, let us believe in it.",
        "themes": ["self-confidence", "strength"],
        "situations": "Feeling inferior to toppers or classmates; thinking 'I can't do this'",
        "volume": 3, "section": "Lectures from Colombo to Almora", "chapter": "Vedanta in its Application to Indian Life",
        "url": SITE + "volume_3/lectures_from_colombo_to_almora/vedanta_in_its_applications_to_indian_life.htm",
    },
    {
        "id": "be_strong_young_friends",
        "text": "First of all, our young men must be strong. Religion will come afterwards. Be strong, my young friends; that is my advice to you.",
        "themes": ["strength"],
        "situations": "Neglecting health and sleep during exams; building physical and mental strength",
        "volume": 3, "section": "Lectures from Colombo to Almora", "chapter": "Vedanta in its Application to Indian Life",
        "url": SITE + "volume_3/lectures_from_colombo_to_almora/vedanta_in_its_applications_to_indian_life.htm",
    },
    {
        "id": "tremendous_faith",
        "text": "Have a tremendous faith in yourselves, like the faith I had when I was a child, and which I am working out now. Have that faith, each one of you, in yourself — that eternal power is lodged in every soul — and you will revive the whole of India.",
        "themes": ["self-confidence"],
        "situations": "Worrying about the future or career; doubting one's own potential",
        "volume": 3, "section": "Lectures from Colombo to Almora", "chapter": "The Future of India",
        "url": SITE + "volume_3/lectures_from_colombo_to_almora/the_future_of_india.htm",
    },
    {
        "id": "greatest_error_weak",
        "text": "The Vedanta recognises no sin, it only recognises error. And the greatest error, says the Vedanta, is to say that you are weak, that you are a sinner, a miserable creature, and that you have no power and you cannot do this and that.",
        "themes": ["self-confidence", "strength"],
        "situations": "Negative self-talk after a bad test; calling yourself useless",
        "volume": 2, "section": "Practical Vedanta and other lectures", "chapter": "Practical Vedanta: Part I",
        "url": SITE + "volume_2/practical_vedanta_and_other_lectures/practical_vedanta_part_i.htm",
    },
    {
        "id": "positive_strong_thought",
        "text": "Men are taught from childhood that they are weak and sinners. Teach them that they are all glorious children of immortality, even those who are the weakest in manifestation. Let positive, strong, helpful thought enter into their brains from very childhood. Lay yourselves open to these thoughts, and not to weakening and paralysing ones.",
        "themes": ["self-confidence", "thoughts"],
        "situations": "Overwhelmed by discouraging comments from others; choosing positive thoughts",
        "volume": 2, "section": "Jnana-Yoga", "chapter": "The Real Nature of Man",
        "url": SITE + "volume_2/jnana-yoga/the_real_nature_of_man.htm",
    },
    {
        "id": "taught_weakness",
        "text": "From my childhood everyone around me taught weakness; I have been told ever since I was born that I was a weak thing. It is very difficult for me now to realise my own strength, but by analysis and reasoning I gain knowledge of my own strength, I realise it.",
        "themes": ["self-confidence"],
        "situations": "Always being told you are 'average'; learning to see your own ability",
        "volume": 2, "section": "Practical Vedanta and other lectures", "chapter": "Practical Vedanta: Part III",
        "url": SITE + "volume_2/practical_vedanta_and_other_lectures/practical_vedanta_part_iii.htm",
    },
    {
        "id": "strength_is_life",
        "text": "This is the great fact: strength is life, weakness is death. Strength is felicity, life eternal, immortal; weakness is constant strain and misery: weakness is death.",
        "themes": ["strength"],
        "situations": "Feeling drained and stressed; choosing strength over giving in",
        "volume": 2, "section": "Work and its Secret", "chapter": "Work and its Secret",
        "url": SITE + "volume_2/work_and_its_secret.htm",
    },
    # ---------------- Failure / perseverance / goal ----------------
    {
        "id": "never_mind_failures",
        "text": "Never mind failures; they are quite natural, they are the beauty of life, these failures. What would life be without them? It would not be worth having if it were not for struggles. Where would be the poetry of life?",
        "themes": ["failure"],
        "situations": "Failed an exam or got rejected; accepting failure as part of the journey",
        "volume": 2, "section": "Jnana-Yoga", "chapter": "God in Everything",
        "url": SITE + "volume_2/jnana-yoga/god_in_everything.htm",
    },
    {
        "id": "fail_a_thousand_times",
        "text": "So never mind these failures, these little backslidings; hold the ideal a thousand times, and if you fail a thousand times, make the attempt once more.",
        "themes": ["failure", "goal"],
        "situations": "Failing repeatedly (re-attempts, entrance exams, coding bugs); trying once more",
        "volume": 2, "section": "Jnana-Yoga", "chapter": "God in Everything",
        "url": SITE + "volume_2/jnana-yoga/god_in_everything.htm",
    },
    {
        "id": "attention_to_means",
        "text": "But whenever failure comes, if we analyse it critically, in ninety-nine per cent of cases we shall find that it was because we did not pay attention to the means. Proper attention to the finishing, strengthening, of the means is what we need. With the means all right, the end must come.",
        "themes": ["failure", "work"],
        "situations": "Analysing poor marks; fixing the study method instead of obsessing over results",
        "volume": 2, "section": "Work and its Secret", "chapter": "Work and its Secret",
        "url": SITE + "volume_2/work_and_its_secret.htm",
    },
    {
        "id": "bring_in_the_light",
        "text": "What good will it do you to think all your lives, \"Oh, I have done evil, I have made many mistakes\"? It requires no ghost to tell us that. Bring in the light and the evil goes in a moment.",
        "themes": ["failure", "self-confidence"],
        "situations": "Stuck regretting past mistakes or a wasted semester; moving forward",
        "volume": 2, "section": "Practical Vedanta and other lectures", "chapter": "Practical Vedanta: Part IV",
        "url": SITE + "volume_2/practical_vedanta_and_other_lectures/practical_vedanta_part_iv.htm",
    },
    {
        "id": "misery_greater_teacher",
        "text": "Good and evil have an equal share in moulding character, and in some instances misery is a greater teacher than happiness. In studying the great characters the world has produced, I dare say, in the vast majority of cases, it would be found that it was misery that taught more than happiness, it was poverty that taught more than wealth, it was blows that brought out their inner fire more than praise.",
        "themes": ["failure", "character"],
        "situations": "After a failure, rejection or harsh criticism from teachers or peers",
        "volume": 1, "section": "Karma-Yoga", "chapter": "Karma in its Effect on Character",
        "url": SITE + "volume_1/karma-yoga/effect_on_character.htm",
    },
    {
        "id": "take_up_one_idea",
        "text": "Take up one idea. Make that one idea your life — think of it, dream of it, live on that idea. Let the brain, muscles, nerves, every part of your body, be full of that idea, and just leave every other idea alone. This is the way to success, and this is the way great spiritual giants are produced.",
        "themes": ["goal", "concentration"],
        "situations": "Juggling too many goals; multitasking; committing to one exam or project",
        "volume": 1, "section": "Raja-Yoga", "chapter": "Pratyahara and Dharana",
        "url": SITE + "volume_1/raja-yoga/pratyahara_and_dharana.htm",
    },
    {
        "id": "perseverance_drink_ocean",
        "text": "To succeed, you must have tremendous perseverance, tremendous will. \"I will drink the ocean,\" says the persevering soul, \"at my will mountains will crumble up.\" Have that sort of energy, that sort of will, work hard, and you will reach the goal.",
        "themes": ["goal", "failure"],
        "situations": "Giving up after a few days of prep; long competitive-exam journey; staying consistent",
        "volume": 1, "section": "Raja-Yoga", "chapter": "Pratyahara and Dharana",
        "url": SITE + "volume_1/raja-yoga/pratyahara_and_dharana.htm",
    },
    # ---------------- Concentration / mind / habits ----------------
    {
        "id": "knock_with_concentration",
        "text": "How has all the knowledge in the world been gained but by the concentration of the powers of the mind? The world is ready to give up its secrets if we only know how to knock, how to give it the necessary blow. The strength and force of the blow come through concentration.",
        "themes": ["concentration"],
        "situations": "Can't crack a hard topic; scattered study sessions; wondering why others learn faster",
        "volume": 1, "section": "Raja-Yoga", "chapter": "Introductory",
        "url": SITE + "volume_1/raja-yoga/introductory.htm",
    },
    {
        "id": "success_is_concentration",
        "text": "The main difference between men and the animals is the difference in their power of concentration. All success in any line of work is the result of this.",
        "themes": ["concentration"],
        "situations": "Short attention span; constant notification-checking; wanting success without focus",
        "volume": 6, "section": "Lectures and Discourses", "chapter": "Concentration and Breathing",
        "url": SITE + "volume_6/lectures_and_discourses/concentration_and_breathing.htm",
    },
    {
        "id": "essence_of_education",
        "text": "To me the very essence of education is concentration of mind, not the collecting of facts. If I had to do my education over again, and had any voice in the matter, I would not study facts at all. I would develop the power of concentration and detachment, and then with a perfect instrument I could collect facts at will.",
        "themes": ["concentration", "education"],
        "situations": "Rote-cramming before exams; feeling studying is just memorising facts",
        "volume": 6, "section": "Lectures and Discourses", "chapter": "Concentration and Breathing",
        "url": SITE + "volume_6/lectures_and_discourses/concentration_and_breathing.htm",
    },
    {
        "id": "monkey_mind",
        "text": "The human mind is like that monkey, incessantly active by its own nature; then it becomes drunk with the wine of desire, thus increasing its turbulence. After desire takes possession comes the sting of the scorpion of jealousy at the success of others, and last of all the demon of pride enters the mind, making it think itself of all importance. How hard to control such a mind!",
        "themes": ["concentration", "thoughts"],
        "situations": "Restless mind; comparing yourself to classmates on social media; jealousy at others' results",
        "volume": 1, "section": "Raja-Yoga", "chapter": "Pratyahara and Dharana",
        "url": SITE + "volume_1/raja-yoga/pratyahara_and_dharana.htm",
    },
    {
        "id": "watch_the_monkey",
        "text": "It is like that monkey jumping about. Let the monkey jump as much as he can; you simply wait and watch. Knowledge is power, says the proverb, and that is true. Until you know what the mind is doing you cannot control it.",
        "themes": ["concentration", "calm"],
        "situations": "Mind wanders when you sit to study; urge to grab the phone; starting a focus habit",
        "volume": 1, "section": "Raja-Yoga", "chapter": "Pratyahara and Dharana",
        "url": SITE + "volume_1/raja-yoga/pratyahara_and_dharana.htm",
    },
    {
        "id": "impressions_on_mind",
        "text": "Every work that we do, every movement of the body, every thought that we think, leaves such an impression on the mind-stuff, and even when such impressions are not obvious on the surface, they are sufficiently strong to work beneath the surface, subconsciously. What we are every moment is determined by the sum total of these impressions on the mind.",
        "themes": ["thoughts", "character"],
        "situations": "Late-night scrolling habits; what you consume shapes you; building small daily habits",
        "volume": 1, "section": "Karma-Yoga", "chapter": "The Secret of Work",
        "url": SITE + "volume_1/karma-yoga/secret_of_work.htm",
    },
    {
        "id": "character_impressions",
        "text": "This is really what is meant by character; each man's character is determined by the sum total of these impressions. If good impressions prevail, the character becomes good; if bad, it becomes bad.",
        "themes": ["thoughts", "character"],
        "situations": "Choosing friends and content; breaking a bad habit; building discipline",
        "volume": 1, "section": "Karma-Yoga", "chapter": "The Secret of Work",
        "url": SITE + "volume_1/karma-yoga/secret_of_work.htm",
    },
    {
        "id": "responsible_for_what_we_are",
        "text": "We are responsible for what we are; and whatever we wish ourselves to be, we have the power to make ourselves. If what we are now has been the result of our own past actions, it certainly follows that whatever we wish to be in future can be produced by our present actions; so we have to know how to act.",
        "themes": ["thoughts", "character", "goal"],
        "situations": "Blaming circumstances for low marks; fresh start after failure; owning your future",
        "volume": 1, "section": "Karma-Yoga", "chapter": "Karma in its Effect on Character",
        "url": SITE + "volume_1/karma-yoga/effect_on_character.htm",
    },
    # ---------------- Education ----------------
    {
        "id": "education_assimilation",
        "text": "Education is not the amount of information that is put into your brain and runs riot there, undigested, all your life. We must have life-building, man-making, character-making assimilation of ideas.",
        "themes": ["education", "character"],
        "situations": "Information overload; marks-only mindset; asking why we study at all",
        "volume": 3, "section": "Lectures from Colombo to Almora", "chapter": "The Future of India",
        "url": SITE + "volume_3/lectures_from_colombo_to_almora/the_future_of_india.htm",
    },
    {
        "id": "education_character",
        "text": "Mere book-learning won't do. We want that education by which character is formed, strength of mind is increased, the intellect is expanded, and by which one can stand on one's own feet.",
        "themes": ["education", "character"],
        "situations": "Purpose of college; becoming self-reliant; choosing skills over just grades",
        "volume": 5, "section": "Conversations and Dialogues", "chapter": "II - V Shri Surendra Nath Sen",
        "url": SITE + "volume_5/conversations_and_dialogues/ii_v_shri_surendra_nath_sen.htm",
    },
    # ---------------- Work / results ----------------
    {
        "id": "perfect_the_means",
        "text": "Let us perfect the means; the end will take care of itself. For the world can be good and pure, only if our lives are good and pure. It is an effect, and we are the means. Therefore, let us purify ourselves.",
        "themes": ["work"],
        "situations": "Exam-result anxiety; focusing on daily study instead of the final rank",
        "volume": 2, "section": "Work and its Secret", "chapter": "Work and its Secret",
        "url": SITE + "volume_2/work_and_its_secret.htm",
    },
    {
        "id": "judged_by_spirit",
        "text": "There is no use in grumbling against nature's adjustment. He who does the lower work is not therefore a lower man. No man is to be judged by the mere nature of his duties, but all should be judged by the manner and the spirit in which they perform them.",
        "themes": ["work", "self-confidence"],
        "situations": "Career comparison, a lower-ranked college or small internship, feeling inferior to peers",
        "volume": 1, "section": "Karma-Yoga", "chapter": "What is Duty?",
        "url": SITE + "volume_1/karma-yoga/what_is_duty.htm",
    },
    {
        "id": "work_not_care_result",
        "text": "It is the most difficult thing in this world to work and not care for the result, to help a man and never think that he ought to be grateful, to do some good work and at the same time never look to see whether it brings you name or fame, or nothing at all.",
        "themes": ["work", "service"],
        "situations": "Doing team-project work nobody credits; studying without obsessing over results",
        "volume": 1, "section": "Karma-Yoga", "chapter": "Each is great in his own place",
        "url": SITE + "volume_1/karma-yoga/each_is_great.htm",
    },
    {
        "id": "good_without_approbation",
        "text": "Even the most arrant coward becomes brave when the world praises him. A fool can do heroic deeds when the approbation of society is upon him, but for a man to constantly do good without caring for the approbation of his fellow men is indeed the highest sacrifice man can perform.",
        "themes": ["service", "work"],
        "situations": "Chasing likes and validation; feeling unseen when your good work gets no praise",
        "volume": 1, "section": "Karma-Yoga", "chapter": "Each is great in his own place",
        "url": SITE + "volume_1/karma-yoga/each_is_great.htm",
    },
    # ---------------- Service ----------------
    {
        "id": "position_of_giver",
        "text": "If you can invariably take the position of a giver, in which everything given by you is a free offering to the world, without any thought of return, then will your work bring you no attachment. Attachment comes only where we expect a return.",
        "themes": ["service"],
        "situations": "Helping friends or volunteering and feeling hurt when nobody says thanks",
        "volume": 1, "section": "Karma-Yoga", "chapter": "The Secret of Work",
        "url": SITE + "volume_1/karma-yoga/secret_of_work.htm",
    },
    {
        "id": "moral_gymnasium",
        "text": "Our duty is to sympathise with the weak and to love even the wrongdoer. The world is a grand moral gymnasium wherein we have all to take exercise so as to become stronger and stronger spiritually.",
        "themes": ["service", "calm"],
        "situations": "Dealing with a classmate who wronged you; seeing hard days as practice",
        "volume": 1, "section": "Karma-Yoga", "chapter": "We help ourselves, not the world",
        "url": SITE + "volume_1/karma-yoga/we_help_ourselves.htm",
    },
    {
        "id": "blessed_is_the_giver",
        "text": "It is not the receiver that is blessed, but it is the giver. Be thankful that you are allowed to exercise your power of benevolence and mercy in the world, and thus become pure and perfect.",
        "themes": ["service"],
        "situations": "Tutoring juniors, NSS or volunteering, sharing notes without feeling superior",
        "volume": 1, "section": "Karma-Yoga", "chapter": "We help ourselves, not the world",
        "url": SITE + "volume_1/karma-yoga/we_help_ourselves.htm",
    },
    {
        "id": "do_good_for_ourselves",
        "text": "Let us give up all this foolish talk of doing good to the world. It is not waiting for your or my help; yet we must work and constantly do good, because it is a blessing to ourselves. That is the only way we can become perfect.",
        "themes": ["service"],
        "situations": "Wanting to do something meaningful; volunteering out of ego vs out of growth",
        "volume": 1, "section": "Karma-Yoga", "chapter": "We help ourselves, not the world",
        "url": SITE + "volume_1/karma-yoga/we_help_ourselves.htm",
    },
    # ---------------- Calm / anger / stress ----------------
    {
        "id": "calm_in_the_city",
        "text": "The ideal man is he who, in the midst of the greatest silence and solitude, finds the intensest activity, and in the midst of the intensest activity finds the silence and solitude of the desert. He goes through the streets of a big city with all its traffic, and his mind is as calm as if he were in a cave, where not a sound could reach him; and he is intensely working all the time.",
        "themes": ["calm", "concentration"],
        "situations": "Staying calm in exam-season chaos or a noisy hostel; being alone but productive",
        "volume": 1, "section": "Karma-Yoga", "chapter": "Karma in its Effect on Character",
        "url": SITE + "volume_1/karma-yoga/effect_on_character.htm",
    },
    {
        "id": "wave_of_anger",
        "text": "When a big wave of anger has come into the mind, how are we to control that? Just by raising an opposing wave. Think of love.",
        "themes": ["calm"],
        "situations": "Angry after fights with roommates, siblings or parents; anger after a bad grade",
        "volume": 1, "section": "Raja-Yoga", "chapter": "Concentration: Its Practice",
        "url": SITE + "volume_1/raja-yoga/concentration_its_practice.htm",
    },
    {
        "id": "duty_seldom_sweet",
        "text": "Duty is seldom sweet. It is only when love greases its wheels that it runs smoothly; it is a continuous friction otherwise.",
        "themes": ["work", "calm"],
        "situations": "Studying feels like a burden; doing chores or assignments with resentment",
        "volume": 1, "section": "Karma-Yoga", "chapter": "What is Duty?",
        "url": SITE + "volume_1/karma-yoga/what_is_duty.htm",
    },
]

# The website's five themes → which quote themes fit them.
APP_THEMES = {
    "courage": ["courage", "strength", "failure"],
    "concentration": ["concentration", "goal", "thoughts", "calm"],
    "self-confidence": ["self-confidence", "strength", "failure"],
    "education": ["education", "character", "thoughts", "concentration"],
    "service": ["service", "work"],
}

THEME_TITLES = {
    "courage": "Courage & Fearlessness",
    "strength": "Inner Strength",
    "self-confidence": "Self-Confidence",
    "failure": "Facing Failure",
    "goal": "Goal & Perseverance",
    "concentration": "Concentration",
    "thoughts": "Thoughts & Habits",
    "character": "Character",
    "education": "True Education",
    "work": "Work & Results",
    "service": "Service",
    "calm": "Calm Mind",
}

QUOTES_BY_ID = {q["id"]: q for q in QUOTES}


def source_line(q: dict) -> str:
    return f'{BOOK}, Vol. {q["volume"]}, {q["section"]}, "{q["chapter"]}"'


def as_teaching(q: dict) -> dict:
    """The quote in the 'teaching' shape the rest of the backend already uses."""
    return {
        "id": q["id"],
        "theme": THEME_TITLES.get(q["themes"][0], q["themes"][0].title()),
        "themes": q["themes"],
        "title": f'{THEME_TITLES.get(q["themes"][0], "Teaching")} · {q["chapter"]}',
        "type": "Exact passage",
        "quote": q["text"],
        "original_context": f'From "{q["chapter"]}" ({q["section"]}), Volume {q["volume"]} of the Complete Works.',
        "source": source_line(q),
        "source_url": q["url"],
        "volume_page": f'CWSV Vol. {q["volume"]}, "{q["chapter"]}"',
        "situations": q["situations"],
        "authenticity_status": "VERIFIED_VERBATIM",
    }
