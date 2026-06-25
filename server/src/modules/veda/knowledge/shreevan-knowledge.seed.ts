/**
 * Shreevan Wellness knowledge pack — the source-of-truth content that powers
 * Veda's RAG (Retrieval-Augmented Generation) across chat / WhatsApp / email / voice.
 *
 * HOW IT WORKS
 *  - Each "## [Category] Title" block below becomes one VedaKnowledge entry.
 *  - Each entry is embedded separately, so keep them focused on a single topic
 *    (that is what makes retrieval accurate — not one giant blob).
 *  - Re-running the seed UPSERTS by title: edit a block here, push, click the
 *    "Load Shreevan knowledge" button again, and that entry is re-embedded.
 *
 * Editing rules: keep the "## [Category] Title" format. Avoid the backtick
 * character and the sequence "${" inside the text (this is a JS template string).
 */
export const SHREEVAN_KNOWLEDGE_MD = `
## [About] What is Shreevan Wellness
Shreevan Wellness is a premium yoga, meditation and wellness retreat brand on the sacred banks of Maa Ganga in Rishikesh, Uttarakhand, India. We run immersive transformation retreats of 3, 7, 14, 28 and 60 days that combine yoga, meditation, breathwork, sattvic nutrition, nature immersion and self-reflection. Our promise: helping people move from stress, confusion and burnout toward clarity, vitality, balance and inner peace through authentic yogic living. People do not just attend yoga classes here — they experience a personal reset and return home to themselves.

## [About] Our philosophy, vision and mission
Philosophy pillars: Sattva (clarity), Awareness (presence), Simplicity (balanced living), Transformation (inner growth) and Service (contribution). Vision: to create transformative wellness experiences that inspire healthier, happier, more conscious lives. Mission: to provide immersive retreat experiences that nurture physical vitality, emotional resilience, mental clarity and spiritual well-being. We believe healing begins when life slows down.

## [About] Why choose Shreevan Wellness
Small-group experiences (typically 12 to 18 participants), personalized attention, authentic yogic practices, the sacred Ganga environment, experienced facilitators, practical take-home tools, and ongoing community support. Every retreat from 3 to 60 days is designed to create lasting transformation, not just a holiday.

## [Audience] Who our retreats are for
Ideal for burned-out professionals, entrepreneurs and corporate employees, spiritual seekers, career changers, people going through a life transition, and first-time or solo retreat travelers. A common profile is busy, high-achieving individuals (often in their 30s to 50s) who value wellness and work-life balance and want a premium, hassle-free experience. Many participants travel alone and leave with lifelong friendships.

## [Programs] Programs at a glance — which retreat is right for you
We offer five durations, each a different depth of the same transformation journey. 3-Day Reset (Ganga Sattva Reset): a short, powerful escape to recharge — ideal for first-timers, couples and busy professionals. 7-Day Foundation: build healthy habits and a strong wellness routine. 14-Day Transformation: deeper self-discovery and conscious living. 28-Day Inner Awakening (our flagship): complete mind-body reset and sustainable life redesign. 60-Day Yogic Living Immersion: profound personal transformation and advanced practice. If unsure, book a free consultation and we will recommend the best fit.

## [Programs] 3-Day Reset Retreat (Ganga Sattva Reset)
Theme: Pause, Breathe, Reconnect. A short yet powerful escape to recharge, relax and reconnect. Ideal for busy professionals, entrepreneurs, first-time retreat attendees, couples and solo travelers. Outcomes: better sleep, mental lightness, a simple yoga practice, basic breathwork, a first meditation experience, an understanding of sattvic living, and a personal morning routine to take home. Includes sattvic meals, yoga and breathwork, a Ganga awareness walk and guided reflection.

## [Programs] 7-Day Foundation Retreat
Build healthy habits and establish a strong wellness routine. Outcomes: physical rejuvenation, mindfulness practices and emotional balance. A natural step up from the 3-day reset for those who want to embed a routine, not just sample it.

## [Programs] 14-Day Transformation Retreat
Dive deeper into self-discovery and conscious living. Outcomes: emotional healing, lifestyle transformation and greater self-awareness. For people ready to go beyond habit-building into deeper personal change.

## [Programs] 28-Day Inner Awakening — flagship (Sattva Ganga: 28 Days to Your True Self)
Our flagship immersive program and a complete personal reset. Outcomes: complete mind-body reset, spiritual growth and a sustainable life redesign. Over 28 days a participant receives 120 to 140 structured sessions and activities — we position it as more than 125 guided experiences over 28 days designed to restore your body, calm your mind, and help you reconnect with your true self. This is not 28 days of yoga; it is a personal reset and transformation experience. Standard price USD 2,200.

## [Programs] 60-Day Yogic Living Immersion
For those seeking profound personal transformation. Outcomes: deep habit change, advanced yogic practices and life-purpose alignment. Our deepest program, also offered as a monthly masterclass batch.

## [Schedule] 28-Day daily schedule
Each day of the 28-day retreat includes six core sessions. 1) Morning Yoga and Pranayama (90 min): asana, breathwork, mobility, energy balancing. 2) Morning Intention Circle (15 to 20 min): reflection and goal setting. 3) Workshop or Learning Session (90 min): yogic philosophy, self-awareness, mindfulness, habit and emotional intelligence. 4) Afternoon Transformational Activity (2 to 3 hrs): sattvic cooking, mindful trek, boat ride, karma yoga, art journaling, life planning. 5) Evening Meditation or Yoga Nidra (45 to 60 min): meditation, Yoga Nidra, Trataka, sound healing, silence. 6) Evening Reflection Circle (45 min): sharing and integration.

## [Schedule] 28-Day weekly journey
Week 1 — Detox and Grounding (physical and mental detox). Week 2 — Emotional Healing and Nature (emotional release and connection; includes a trek, sound bath and kirtan). Week 3 — Personal Transformation (clarity and self-discovery; includes a boat ride and life-design workshop). Week 4 — Integration and Future Planning (a sustainable life plan; includes a full-day retreat, an Ayurveda session and a graduation ceremony).

## [Schedule] 28-Day total experience
Across 28 days each participant receives approximately: 28 yoga classes, 28 meditation or Yoga Nidra sessions, 24 to 26 workshops, 24 to 25 group sharing circles, 4 sattvic meal-preparation classes, 3 fire ceremonies, 1 trek, 1 boat ride, 1 sound-bath healing, 4 karma-yoga sessions, 3 silent-practice days, 1 full-day immersion retreat and a graduation and integration session — 120 to 140 guided experiences in total.

## [Experience] What you will experience
Daily yoga and pranayama, guided meditation, Yoga Nidra, breathwork, sattvic meals, nature excursions, fire ceremonies, chanting and kirtan, self-reflection workshops, Ayurveda principles and community connection. Take-home tools include a personal wellness blueprint, sattvic cooking skills and a stress-management toolkit (breathwork, meditation, journaling and Yoga Nidra).

## [Experience] Transformation outcomes
Physical: better sleep, more energy, improved flexibility, better digestion, reduced fatigue, natural weight balance, and reduced dependency on caffeine, junk food, alcohol and sugar. Mental: a quieter mind, less overthinking and anxiety, better focus, and clarity of direction. Emotional: release of emotional baggage, healing from burnout, more self-acceptance and confidence. Spiritual: a daily meditation habit, inner stillness, and deeper connection with nature and self. The core promise is to create enough space within yourself to clearly see what truly matters. Individual outcomes vary and are never guaranteed.

## [Experience] Included live and online sessions
Every retreat includes structured live sessions. Before the retreat: Welcome and Community (21 days prior), Preparing Body and Mind (14 days prior), Travel and Final Preparation (7 days prior). After the retreat: Integration and Accountability (7 days after), Habit Reinforcement (30 days after), Alumni Circle (90 days after). That is 6 structured live sessions plus lifetime alumni community access and a free Monthly Online Satsang (first Sunday of every month: breathwork, meditation, a wisdom talk and Q&A) for all past participants.

## [Pricing] Program pricing
The 28-Day Inner Awakening flagship has a standard price of USD 2,200. The minimum selling price is USD 2,000, and price never goes below 2,000 without founder approval. A non-refundable registration fee secures the booking, and the remaining balance is due at least 25 days before the retreat start. Pricing for the 3, 7, 14 and 60-day programs is shared during a free consultation. We never claim guaranteed medical results.

## [Pricing] Payment terms
To secure a booking, participants pay the applicable non-refundable registration fee at the time of booking, and complete the remaining balance at least 25 days before the retreat start date. Failure to complete payment by the due date may result in cancellation of the booking and forfeiture of the registration fee. International payments are accepted.

## [Location] Where we are and how to reach us
Shreevan Wellness is located in Muni Ki Reti, Rishikesh (near Janki Setu Road, behind Shri Kailash Aashram), Uttarakhand 249137, India — on the sacred banks of Maa Ganga. Optional airport or railway transfer assistance can be arranged. Final arrival instructions, the Google Maps location, check-in timings and weather information are shared about 7 days before arrival.

## [FAQ] Do I need prior yoga experience
No. Beginners are welcome. Sessions are designed so first-timers can comfortably take part, and practices are adapted to different levels.

## [FAQ] Is the retreat religious
No. The practices are spiritual and wellness-focused, not religious. The aim is not to become religious but to become more conscious, present and balanced.

## [FAQ] What is sattvic food and can you handle dietary needs
Sattvic food is fresh, nourishing vegetarian meals prepared to support physical and mental well-being. We make reasonable efforts to accommodate food allergies and dietary preferences — please share your needs during consultation or onboarding. Specific medical diets cannot be guaranteed.

## [FAQ] Can solo travelers join and what is the group size
Absolutely — many participants attend alone and leave with lifelong friends. Groups are small, typically 12 to 18 participants per retreat, which allows personalized attention.

## [FAQ] What should I bring
Comfortable yoga clothing, walking shoes, a water bottle, a notebook, a light jacket, any personal medications, and an open mind. A detailed packing guide is shared before arrival.

## [FAQ] Is airport pickup available
Yes — optional transportation assistance can be arranged. Share your arrival details and we will help coordinate transfer from the nearest airport or railway station.

## [Policies] Refund and cancellation policy
The registration fee is non-refundable under all circumstances. For cancellations more than 10 days before the program start, participants are eligible for a refund of 25 percent of the total retreat fee paid, excluding the non-refundable registration fee. For cancellations within 10 days of the start, no refund is provided. No-shows are not eligible for any refund, credit or transfer. All cancellation requests must be made in writing via email or WhatsApp.

## [Policies] Transfer policy
A booking may be transferred to another individual up to 2 days before the retreat start. The request must be made via email or WhatsApp and include the new participant's full name, contact number, email, emergency contact and any relevant health information. Only one transfer per booking is permitted and no admin fee is charged for approved transfers. The organizer may decline a transfer if the new participant does not meet participation requirements.

## [Policies] Health and wellness disclaimer
Shreevan Wellness programs are for educational, personal-development and wellness purposes only and are not intended to diagnose, treat, cure or prevent any medical or psychological condition; they are not a substitute for medical treatment. Participation is voluntary and at the participant's own risk. Participants should consult a qualified physician before joining and disclose significant health conditions in advance. Individual results vary and are never guaranteed. Veda must never give medical advice or make cure or guaranteed-result claims, and must not ask for or store sensitive health details in chat — sensitive matters are handled through the secure onboarding form.

## [Onboarding] What happens after you book
After payment you receive a booking confirmation and receipt, then a welcome pack within 24 hours (program overview, schedule, accommodation, location, transfer options and policies). You complete a secure onboarding form (personal and emergency contact, dietary preferences, relevant health information and experience level). The team reviews suitability and safety. Pre-retreat emails follow at 21, 14 and 7 days before arrival, plus a private WhatsApp community group 5 days before. After the retreat you receive an integration guide, a 14-day check-in, a 30-day group session and lifetime alumni access.

## [Onboarding] Consultation and sales process
The customer journey is: ad or social or website, then a lead form or WhatsApp, then a qualification call, then a discovery consultation, then a program recommendation, then payment, then onboarding. The free discovery consultation explores current lifestyle, wellness goals, stress levels, prior retreat experience, health considerations, preferred duration and travel plans, then recommends the best-fit program (3, 7, 14, 28 or 60 days). New leads should receive a response within about 10 minutes.
`;

export interface ParsedKnowledge {
  title: string;
  content: string;
  category: string;
}

/** Split the markdown pack into one focused entry per "## [Category] Title" block. */
export function parseKnowledgeMarkdown(md: string): ParsedKnowledge[] {
  const blocks = md.split(/\n(?=## )/g);
  const out: ParsedKnowledge[] = [];
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block.startsWith('## ')) continue;
    const nl = block.indexOf('\n');
    const header = (nl === -1 ? block : block.slice(0, nl)).replace(/^##\s*/, '').trim();
    const body = nl === -1 ? '' : block.slice(nl + 1).trim();
    const m = header.match(/^\[(.+?)\]\s*(.+)$/);
    const category = m ? m[1].trim() : 'General';
    const title = m ? m[2].trim() : header;
    if (!title || !body) continue;
    out.push({ title, content: body, category });
  }
  return out;
}
