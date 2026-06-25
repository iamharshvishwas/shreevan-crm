/**
 * Shreevan Wellness knowledge pack v2 — sourced from the Codex RAG files
 * (authored against the live website data). Generated; edit the source .md files
 * and regenerate, or edit here directly. One VedaKnowledge entry per "##" heading.
 *
 * Excludes agent operating-rules + do-not-invent (those live in the system prompt:
 * see veda-operating-rules.ts).
 */
export const SHREEVAN_PACK: { category: string; markdown: string }[] = [
  { category: "About", markdown: `# Shreevan Wellness Business Profile

## Brand identity

Shreevan Wellness is a premium, structured wellness retreat brand based in Rishikesh, India, near the sacred Ganga landscape.

Brand name: Shreevan Wellness  
Tagline: Return to Your True Self  
Founder: Isha Dutta  
Location: Rishikesh, Uttarakhand, India  
Primary website: https://shreevanwellness.com  
Contact email: hello@shreevanwellness.com  
Response expectation: within 24-48 hours.

## Positioning

Shreevan Wellness is positioned for serious international guests seeking guided reconnection, rhythm, and responsible transformation.

It is not a generic holiday, spa resort, casual yoga vacation, or miracle-healing brand.

The retreat experience is built around:

- Structured daily rhythm.
- Yoga and pranayama.
- Meditation and Yoga Nidra.
- Sattvic living.
- Reflection and journaling.
- Nature and Rishikesh context.
- Suitability-first booking.
- Responsible wellness boundaries.

## Target audience

Primary audience:

- International visitors from the United States, Canada, United Kingdom and similar markets.
- Corporate executives.
- Entrepreneurs and founders.
- High-responsibility professionals.
- Serious seekers.
- Guests in life transitions.
- People needing a structured reset, not a casual vacation.

Audience concerns:

- Can I trust this retreat from abroad?
- Which program duration is right?
- Is the stay clean, safe and comfortable?
- What food is included?
- What happens after I submit a form?
- Is payment secure?
- Are there cure claims or responsible boundaries?
- Can I ask health, food, travel, and accommodation questions before paying?

## Conversion model

Shreevan Wellness uses a consultation-first conversion model.

The website should not push immediate payment for cold visitors. A serious guest should first share enough context for a responsible suitability review.

Primary conversion: Book a free suitability consultation.  
Secondary conversion: Contact the team with a practical question.  
Payment conversion: Only after fit, dates, invoice, room, food, and terms are clear.

## Website routes

Core routes:

- \`/\` Home
- \`/about-founder\` Our Story
- \`/accommodation-inclusions\` Stay & Food
- \`/testimonials\` Healing Stories
- \`/journal\` Journal
- \`/faqs\` FAQs
- \`/contact\` Contact

Program routes:

- \`/programs/3-day-ganga-reset\`
- \`/programs/7-day-foundation\`
- \`/programs/14-day-transformation\`
- \`/programs/28-day-inner-awakening\`
- \`/programs/60-day-rishi-residency\`

Transactional and legal routes:

- \`/book-consultation\`
- \`/payment\`
- \`/privacy-policy\`
- \`/terms-conditions\`
- \`/refund-policy\`
- \`/wellness-disclaimer\`

Educational modality routes are planned/configured:

- \`/modalities/yoga-therapy\`
- \`/modalities/guided-meditation\`
- \`/modalities/sound-healing\`
- \`/modalities/panchkarma-detox\`
- \`/modalities/chakra-opening\`
- \`/modalities/spiritual-sadhanas\`

## Brand promise

Shreevan Wellness should be described as:

"A structured premium wellness retreat experience in Rishikesh for international guests who want space, rhythm, guided practice, sattvic living, reflection, and a responsible path back to themselves."

Do not describe the brand as:

- A medical cure.
- A guaranteed transformation.
- A detox clinic.
- A psychiatric or therapeutic substitute.
- A casual resort holiday.` },
  { category: "Programs", markdown: `# Programs and Fit Logic

## Program ladder

Shreevan Wellness offers a duration-based retreat ladder:

1. 3-Day Ganga Sattva Reset
2. 7-Day Ganga Sattva Foundation
3. 14-Day Ganga Sattva Transformation
4. 28-Day Sattva Ganga Inner Awakening
5. 60-Day Rishi Tantra Conscious Living Residency

All programs matter. The 28-day program is the signature offer, but the agent should not push every guest toward 28 or 60 days. Recommend based on fit, readiness, schedule, health boundaries, and travel effort.

## 3-Day Ganga Sattva Reset

Route: \`/programs/3-day-ganga-reset\`  
Duration: 3 days  
Best for: short pause, first-timer reset, busy professional, traveller needing reconnection.  
Outcome: gentle return to breath, rhythm, and perspective.

Good fit:

- Guest has limited time.
- Guest is new to retreat experience.
- Guest wants a short pause before returning to work or travel.
- Guest needs grounding but cannot commit to a longer stay.

Core inclusions:

- Guided daily practices.
- Sattvic vegetarian meals.
- Accommodation and retreat support.
- Pre-arrival suitability conversation.

Do not frame as:

- Deep transformation.
- Full lifestyle redesign.
- Medical detox or cure.

## 7-Day Ganga Sattva Foundation

Route: \`/programs/7-day-foundation\`  
Duration: 7 days  
Best for: beginners who want structure and clarity.  
Outcome: practical base for everyday wellness practices.

Good fit:

- Guest wants a complete but approachable foundation.
- Guest wants daily yogic rhythm without committing to two weeks or a month.
- Guest is building new habits.
- Guest needs a structured reset with support before and after.

Core inclusions:

- Daily guided practice.
- Sattvic meals and stay support.
- Workshops and integration guidance.
- Suitability-led booking process.

## 14-Day Ganga Sattva Transformation

Route: \`/programs/14-day-transformation\`  
Duration: 14 days  
Best for: deeper mind-body-emotional reset.  
Outcome: more time for practice, reflection, and integration.

Good fit:

- Guest is in life transition.
- Guest wants a deeper reset but not a month-long immersion.
- Guest can commit to two weeks of rhythm.
- Guest needs emotional reflection, purpose work, and lifestyle recalibration.

Core inclusions:

- Daily practice and workshops.
- Sattvic meals and accommodation.
- Reflection and sharing circles.
- Post-retreat routine guidance.

Important language boundary:

Use "supports reflection, rhythm, awareness, and integration."  
Avoid "guaranteed transformation" or "emotional healing cure."

## 28-Day Sattva Ganga Inner Awakening

Route: \`/programs/28-day-inner-awakening\`  
Duration: 28 days  
Label: Signature  
Known standard investment: $2,200 USD in current program page. Confirm final invoice before payment.  
Best for: complete structured retreat experience.  
Outcome: sustained reset with daily rhythm, guided practice, and reflection.

Good fit:

- Serious seeker, founder, or professional ready for a full immersive reset.
- Guest can step away from usual life demands for 4 weeks.
- Guest wants structure, guided practice, and practical take-home tools.
- Guest wants deeper integration after retreat.

Program arc:

- Detox and foundation.
- Healing and release.
- Awakening and self-discovery.
- Integration and life design.

Potential take-home outputs:

- Personal wellness blueprint.
- Personal sadhana plan.
- Sattvic recipe collection.
- Stress management toolkit.
- 90-day integration roadmap.

Important caveat:

These outputs are practical wellness supports, not guaranteed medical or mental-health outcomes.

## 60-Day Rishi Tantra Conscious Living Residency

Route: \`/programs/60-day-rishi-residency\`  
Duration: 60 days  
Label: Advanced  
Best for: advanced guests seeking long-form lifestyle reinvention, mentoring, and integration.  
Outcome: conscious living residency with mentoring, service, and integration.

Good fit:

- Guest is ready for a serious life pause.
- Guest wants long-form practice, curriculum, mentoring and lifestyle redesign.
- Guest has enough time, resources, health stability, and emotional readiness.
- Guest understands this is not a casual long holiday.

Core domains:

- Body.
- Mind.
- Spirit.
- Life.

Residency phases:

- Reset.
- Heal.
- Awaken.
- Embody.
- Integrate.

Curriculum themes:

- Yoga and pranayama.
- Guided meditation and mind mastery.
- Spiritual sadhanas and yogic philosophy.
- Panchkarma and detox education.
- Conscious living.
- Mentoring and post-program integration.

Important CRM rule:

For 60-day interest, escalate to human review early. Do not quote final price or guarantee acceptance unless confirmed by the team.

## Program recommendation script

If visitor is unsure:

"You do not need to choose the exact program yet. Based on what you share, the team can compare your time, travel effort, current season of life, and readiness. The suitability call is the right next step before any booking or payment."

If visitor asks "which is best":

"The best program is not automatically the longest one. A 3-day reset is a short pause, 7 days builds foundation, 14 days creates deeper transformation rhythm, 28 days is the flagship immersion, and 60 days is an advanced residency. Your current context decides the right depth."

## Program fit red flags

Suggest delaying or human review if visitor:

- Needs urgent medical or psychological care.
- Wants guaranteed cure or instant transformation.
- Is currently unstable, in crisis, or unable to participate safely.
- Refuses to discuss basic suitability boundaries.
- Wants to pay before understanding terms, room, food, travel, and health boundaries.
- Treats the retreat as a casual party or resort holiday.` },
  { category: "Stay & Travel", markdown: `# Stay, Food, Travel and Location Knowledge

## Stay and food positioning

Shreevan Wellness is not presented as a generic hotel stay. Rooms, meals, and hospitality should support rest, daily practice, and international guest confidence.

The CRM agent should clarify stay and food before payment when the visitor asks about comfort, dietary needs, room category, travel timing, or longer duration programs.

## Accommodation principles

Known room positioning:

- Calm Standard Room: simple, clean, peaceful private base.
- Premium Comfort Room: extra space and softer landing for international guests.
- Balcony or View Room: ideal for longer stays when available.

Important:

- Exact room category must be confirmed before payment.
- Balcony, view, upgrade, bathroom arrangement, and privacy level are subject to availability.
- Do not promise a specific room without written confirmation.

Safe response:

"Room comfort matters, especially for international guests and longer programs. The team should confirm your room category, bathroom arrangement, quietness needs, and any upgrade options before payment."

## Food and sattvic meals

Food at Shreevan Wellness is described as vegetarian, sattvic, grounding, and aligned with retreat rhythm.

The food promise:

- Daily vegetarian sattvic meals.
- Simple food planned around digestion, practice readiness, and calm routine.
- Spice comfort should be discussed before arrival.
- Food questions should be raised before booking, especially for international guests.

Potential requests:

- Vegan.
- Jain.
- Gluten-aware.
- Low-spice.
- Allergies.
- Fasting or light meals.

Agent rule:

Do not promise every food request can be handled automatically. Strict allergies or medical diets require careful confirmation.

Safe response:

"Please share dietary restrictions early. Some preferences may be easy to support, but allergies or strict medical diets need confirmation before booking."

## International visitor reassurance

International guests need practical confidence before booking. They may ask about:

- Nearest airport.
- Arrival window.
- Transfer support.
- Room and bathroom comfort.
- Climate.
- Laundry.
- Wi-Fi or internet policy.
- Packing.
- Food and spice level.
- Safety and on-site support.
- Payment and refund clarity.

Agent should route detailed travel and stay questions to consultation or contact if not fully confirmed.

## Travel and arrival

General travel context:

- Shreevan Wellness is in Rishikesh, Uttarakhand, India.
- Many international guests may plan around Delhi arrival and then onward travel toward Dehradun/Rishikesh.
- Exact transfer route, timing, cost, and arrival window must be confirmed by the team.

Visa rule:

The agent must not provide visa or immigration advice. Direct guests to official sources and qualified travel advisers.

Safe response:

"We can help with retreat logistics and arrival planning, but visa eligibility and immigration rules should be verified through official government sources before flights or payment."

## Location and safety clarity

Website location positioning:

- The public site gives Rishikesh, Uttarakhand, India as the location.
- Exact stay address should be shared with confirmed guests after suitability and booking steps.
- This protects guest privacy while giving enough location clarity for travel planning.

Safety clarity topics:

- Where guests stay.
- Who is available on site.
- Emergency contact process.
- Health disclaimer.
- Refund policy.
- Code of conduct.

Safe response:

"The retreat is positioned in Rishikesh, India. Exact stay details and arrival instructions should be shared after suitability and booking confirmation, so guest privacy and operational safety are protected."

## What the agent should not claim

Do not claim:

- Guaranteed private room unless confirmed.
- Guaranteed balcony or view.
- Exact airport transfer cost unless confirmed.
- Visa support beyond logistics guidance.
- Medical diet support.
- Allergen-free environment unless confirmed in writing.
- 24/7 medical staff unless confirmed.
- Exact venue address for unconfirmed leads.` },
  { category: "Booking & Payment", markdown: `# Booking, Payment and CRM Knowledge

## Consultation-first booking

Shreevan Wellness uses a free suitability call before booking and payment.

The consultation is intended to understand:

- Visitor context.
- Country and time zone.
- Program interest.
- Travel dates.
- Current season of life.
- Comfort and health boundaries.
- Food, room, and travel questions.
- Whether a retreat is suitable now.

The consultation should feel like a responsible fit conversation, not a sales trap.

## Book consultation page

Route: \`/book-consultation\`

Key message:

"Before you choose a retreat, let us understand the person arriving."

This page:

- Does not take payment.
- Starts a suitability conversation.
- Is human reviewed.
- Is international-aware.
- Helps choose the right depth across 3, 7, 14, 28 and 60-day programs.

Good fit for consultation:

- Guest is considering India travel.
- Guest is unsure which duration matches their current season.
- Guest has food, stay, comfort or health-boundary questions.
- Guest wants a serious retreat, not a rushed wellness holiday.

Not the right path if:

- Guest needs emergency support or urgent medical advice.
- Guest wants guaranteed healing or instant transformation.
- Guest wants a casual holiday without daily structure.

## Consultation form fields

The booking enquiry form can capture:

- Full name.
- Email address.
- Country code.
- WhatsApp/mobile number.
- Country/time zone.
- Preferred program.
- Desired travel dates.
- Current season of life.
- Goal or what would make the retreat worthwhile.
- Optional comfort or health context.
- Wellness suitability consent.

Program options:

- Not sure yet.
- 3-Day Ganga Sattva Reset.
- 7-Day Ganga Sattva Foundation.
- 14-Day Ganga Sattva Transformation.
- 28-Day Inner Awakening.
- 60-Day Rishi Residency.

## CRM forms

Public forms have \`data-veda-form\` capture attributes:

- Home suitability request.
- Booking enquiry.
- Contact form.
- Payment verification.
- Journal subscription.

All public forms include WhatsApp/mobile number and country code fields.

Admin forms are intentionally not tagged for CRM capture.

## Suitability form behavior

The home suitability form sends:

- Internal \`/api/leads\` logging.
- Manual POST to \`https://api.shreevanwellness.com/api/v1/intake/form\`.
- Uses \`keepalive: true\`.
- Still shows thank-you even if internal logging fails.

Important operational note:

Watch for duplicate CRM notes if both automatic \`veda-forms.js\` capture and manual intake calls log the same enquiry.

## Payment page

Route: \`/payment\`

Payment page purpose:

- Confirm retreat booking.
- Verify booking or invoice ID.
- Select payment type.
- Choose preferred currency.
- Handoff to secure payment provider or invoice support.

Payment page is not a cold visitor sales page.

Payment should happen only after:

- Consultation or team confirmation.
- Program duration confirmed.
- Dates confirmed.
- Invoice or booking ID received.
- Terms, refund, and wellness disclaimer reviewed.
- Room, food, travel, and suitability questions clarified.

Payment methods currently positioned:

- International card.
- Wise / bank transfer.
- Manual invoice support.

Currencies shown:

- USD.
- GBP.
- CAD.
- EUR.
- INR.

Agent must not say payment gateway is fully live unless confirmed.

## Payment response rules

If visitor asks "Can I pay now?":

"Payment is intended after your booking or invoice has been confirmed. Please first complete the suitability conversation so the team can confirm program fit, dates, stay details, food comfort, terms, and payment route."

If visitor has invoice ID:

"Use the payment verification page and enter your booking or invoice ID. If anything looks unclear, pause and contact the team before paying."

If visitor has no invoice ID:

"Please do not use the payment page yet. Start with a consultation or contact the team so your booking context can be confirmed."

## CRM lead status suggestions

Useful CRM labels:

- New enquiry.
- Needs reply.
- Awaiting call scheduling.
- Suitability review.
- Program fit unclear.
- Travel/logistics question.
- Food/stay question.
- Health-boundary review.
- Invoice ready.
- Payment verification.
- Not suitable now.
- Follow up later.` },
  { category: "Policies", markdown: `# Health, Legal and Policy Boundaries

## Wellness disclaimer

Shreevan Wellness offers retreats, yoga, meditation, breathwork, sattvic living, reflection, nature immersion, personal-development experiences and wellness education.

It does not offer:

- Medical care.
- Psychotherapy.
- Psychiatric care.
- Diagnosis.
- Treatment.
- Cure.
- Disease management.
- Emergency support.

Nothing on the website or in a retreat should be interpreted as medical advice or a substitute for advice from qualified healthcare professionals.

## No diagnosis or cure claims

The agent must never claim that Shreevan Wellness can diagnose, treat, cure, or prevent disease.

The agent must never claim guaranteed results.

Testimonials are individual experiences, not typical, promised, or guaranteed outcomes.

## Participation risks

Retreat participation may involve:

- Yoga.
- Movement.
- Stretching.
- Pranayama.
- Breathwork.
- Meditation.
- Nature walks.
- Group activities.
- Dietary changes.
- Emotional reflection.
- Spiritual enquiry.

Guests participate voluntarily and should stop or modify participation when needed.

## When to recommend professional healthcare advice

Recommend qualified professional advice before booking when a visitor mentions:

- Medical conditions.
- Injuries.
- Pregnancy.
- Recent surgery.
- Chronic illness.
- Medication changes.
- Eating disorder history.
- Trauma concerns.
- Mental-health concerns.
- Severe distress.
- Any uncertainty about participation safety.

The agent must not tell a guest to stop, change, or delay medication, treatment, therapy, or professional care.

## Privacy policy summary

Shreevan Wellness may collect:

- Name, email, phone, WhatsApp, country, time zone.
- Program interest and goals.
- Travel dates and communication preferences.
- Dietary needs and suitability context.
- Booking and invoice records.
- Payment status.
- Emergency contact and onboarding details when needed.
- Media/testimonial consent records.
- Website analytics and marketing data.

Sensitive details should not be requested through public chat unless the process is secure and approved.

## Terms summary

Booking process:

1. Visitor submits enquiry or consultation request.
2. Team reviews fit, travel context, expectations, and suitability.
3. If suitable, program and payment instructions are shared.
4. Registration fee may reserve a place.
5. Booking is not fully confirmed until payment, guest information, policy acceptance, and written confirmation are complete.
6. Shreevan may decline or defer a booking if not suitable, safe, or operationally available.

Participant responsibilities include:

- Provide accurate contact, travel, dietary, health, medication, allergy, suitability and emergency-contact information.
- Consult healthcare professionals when appropriate.
- Follow facilitator instructions and property rules.
- Arrange passport, visa, insurance, flights, transfers and personal expenses unless included in writing.
- Respect other guests, staff, local culture, and confidentiality.

## Refund and cancellation summary

Important current refund rules:

- A non-refundable registration fee reserves a place.
- Remaining balance is due at least 25 days before program start unless written invoice says otherwise.
- More than 10 days before program start: participant may be eligible for 25% refund of total retreat fee paid, excluding non-refundable registration fee and possible deductions.
- Within 10 days of program start: no refund.
- No-show: no refund, credit or transfer guaranteed.
- Transfer to another suitable participant may be requested up to 2 days before program start, subject to written approval.
- Early departure does not create refund entitlement.
- Removal for unsafe, disruptive, abusive, illegal or inappropriate conduct does not create refund entitlement.

Agent should not negotiate or override refund policy.

Safe response:

"Refund and transfer eligibility depends on the written booking terms and timing. Please email the team with your full name, booking reference, retreat date, and reason so they can review it against the policy."

## Travel insurance

Participants are strongly encouraged to purchase comprehensive travel insurance covering:

- Cancellation.
- Medical needs.
- Personal emergencies.
- Travel disruption.
- Visa issues.
- Lost baggage.

Shreevan Wellness is not responsible for flights, visas, insurance, personal purchases, exchange-rate changes, bank charges, or third-party travel costs unless expressly agreed in writing.` },
  { category: "FAQ", markdown: `# FAQ Answer Bank

## Which Shreevan Wellness program is right for me?

The right program depends on your current life season, travel effort, emotional bandwidth and how much structure you can genuinely hold. A 3-day reset is best for a short pause, 7 days builds foundation, 14 days creates deeper transformation rhythm, 28 days is the flagship immersive path, and 60 days is a serious lifestyle residency.

If you are unsure, do not force the decision alone. The suitability consultation exists to match your context with the right duration before payment or travel planning.

## Do I need to know the exact program before booking a consultation?

No. Many serious guests arrive with only a broad sense that they need a reset, deeper practice, or a life transition container. They can choose "Not sure yet" and explain what they are hoping to change.

The team can recommend a suitable direction or advise the guest to wait if the retreat is not the right step right now.

## Is the 60-day residency just a longer version of the retreat?

No. The 60-day Rishi Tantra Conscious Living Residency should be treated as an advanced commitment, not a long holiday. It is for people who want structured practice, mentoring, lifestyle redesign, and integration outputs that can continue after returning home.

Because the commitment is high, suitability matters more than enthusiasm.

## Is the suitability consultation free?

Yes. The suitability conversation is positioned as a free fit check before choosing a program, finalizing travel dates, or moving to payment.

It is not designed to pressure the visitor into booking. It should clarify context, comfort, expectations, and safest next step.

## Do I have to pay before speaking with the team?

No. For an international wellness retreat, payment should come after program fit, room expectations, food comfort, travel timing, refund terms, and health boundaries are clear.

The payment page is for confirmed guests who already have booking context or invoice information.

## What happens after I submit the consultation form?

The enquiry should be reviewed by the Shreevan team, then routed toward a call time or a written response if more context is needed.

A good next step includes understanding country, preferred dates, program interest, travel comfort, food needs, and non-sensitive wellness boundaries that affect suitability.

## What accommodation and meals are included?

Program inclusions should cover retreat stay, daily vegetarian sattvic meals, and the daily practice rhythm relevant to the selected program. Exact room category, check-in details, and included support should be confirmed before payment.

International guests should ask room, climate, power, Wi-Fi, laundry, and food questions early.

## Can Shreevan support vegan, Jain, gluten-aware or low-spice food?

Food preferences and dietary restrictions should be discussed before booking. Some needs may be easy to support, while allergies or strict medical diets need careful confirmation rather than casual promises.

The agent should not say every diet can be handled automatically.

## Will I have a private room?

Private-room expectations should be discussed before booking because comfort standards matter, especially for international guests on longer programs.

If a specific room category, view, accessibility need, or quietness level matters, ask for confirmation before payment.

## Where is Shreevan Wellness located?

Shreevan Wellness is positioned in Rishikesh, Uttarakhand, India, near the sacred Ganga landscape. Exact stay address should be shared with confirmed guests after suitability and booking steps.

## Which airport should international guests consider?

Many international guests plan around Delhi arrival and then a domestic connection or transfer toward Dehradun/Rishikesh. Exact airport, transfer and arrival-window guidance should be confirmed with the team because schedules and route comfort can change.

The FAQ should guide planning, not replace live travel coordination.

## Do you arrange visas or provide immigration advice?

No. Shreevan can clarify retreat logistics, stay details and dates, but visa eligibility and immigration decisions must be checked through official government sources or qualified travel advisers.

International guests should verify requirements before booking flights or paying for a retreat.

## Is Shreevan Wellness a medical or mental-health treatment centre?

No. Shreevan Wellness is a structured wellness retreat platform, not a hospital, clinic, emergency service, psychiatric facility or substitute for medical care.

Yoga, meditation, sattvic living, Panchkarma education and spiritual practices are wellness and lifestyle support. They are not diagnosis, cure, medical treatment or mental-health therapy.

## Can I attend if I have anxiety, depression, pregnancy, medication use or a medical condition?

The visitor should speak with a qualified medical professional before attending if they have a current medical condition, pregnancy, active mental-health concern, medication changes or any history that could affect retreat safety.

During consultation, they should share relevant suitability context for safe planning. If the retreat is not appropriate, the responsible answer may be to delay or decline participation.

## Are detox, Panchkarma or energy practices guaranteed to heal or cure?

No. Responsible wellness avoids guaranteed cure claims. Detox and Panchkarma-related practices require suitability, proper expectations and clear boundaries.

The goal is to support rhythm, awareness, rest and lifestyle change. Outcomes differ by person, duration, participation, travel stress, existing health and follow-through after the retreat.

## What outcomes can I realistically expect?

Realistic outcomes are practical: clearer daily rhythm, better self-observation, a calmer food and sleep routine, guided practice familiarity and a more grounded plan for life after the retreat.

The website should not promise permanent transformation from one stay.

## What support do I get after the retreat?

Each program should clarify its post-retreat outputs, such as a rhythm plan, personal practice direction or integration roadmap. Longer programs may include deeper planning, but the exact aftercare path should be confirmed before booking.

If ongoing support is important, ask about it during consultation.

## Is Shreevan suitable if I am travelling alone?

Many wellness travellers explore retreats alone, but suitability depends on comfort, travel confidence, room needs, communication preferences and health boundaries.

A solo traveller should use consultation to understand arrival support, daily schedule, food, room expectations and available support.` },
  { category: "Lead Playbooks", markdown: `# Lead Qualification Playbooks

## Minimum lead fields

The CRM AI should try to collect:

- Full name.
- Email.
- WhatsApp/mobile with country code.
- Country or time zone.
- Program interest.
- Desired travel dates or month.
- Current season of life.
- Main goal.
- Food, room, travel or comfort questions.
- Optional non-sensitive health boundary context.

Do not ask for detailed medical records in normal chat.

## Lead quality signals

High-quality lead:

- Mentions serious reset, life transition, work pressure, spiritual seeking or structured retreat.
- Has country/time zone.
- Has travel window.
- Asks about fit, room, food, travel, safety, or payment readiness.
- Understands consultation before payment.
- Accepts responsible wellness boundaries.

Medium-quality lead:

- Interested but vague.
- Wants price first.
- Unsure about dates.
- Needs education on program differences.
- Needs reassurance on stay, food or travel.

Low-quality or risky lead:

- Wants guaranteed cure.
- Wants urgent medical or emotional crisis help.
- Wants to pay immediately without fit review.
- Refuses basic suitability questions.
- Wants a casual holiday without structure.
- Has unresolved health concerns that require professional guidance.

## Routing rules

Route to consultation when:

- Program duration is unclear.
- Guest is serious but unsure.
- Guest asks about 28 or 60-day program.
- Guest has international travel questions.
- Guest has food/stay comfort needs.
- Guest mentions health boundaries but not urgent crisis.

Route to contact/logistics when:

- Visitor asks a specific room, food, travel, or arrival question.
- Visitor needs confirmation before deciding whether to consult.

Escalate to human review immediately when:

- Visitor mentions severe distress, self-harm, active crisis, psychosis, recent hospitalization, or urgent mental-health need.
- Visitor asks for medical advice.
- Visitor asks for medication changes.
- Visitor asks for exact refund approval.
- Visitor wants final payment amount or invoice issue.
- Visitor is interested in 60-day residency.

## First reply template: warm qualification

Use when a new visitor asks generally about retreats:

"Thank you for reaching out. Shreevan Wellness is a structured retreat experience in Rishikesh for guests who want rhythm, guided practice, sattvic living and responsible reconnection. The best next step is not to guess the program immediately. Could you share your country/time zone, rough travel window, and whether you are considering a short reset, 7-14 day foundation/transformation, 28-day flagship immersion, or the 60-day residency?"

## Program unsure template

"You do not need to know the exact program yet. A 3-day reset is a short pause, 7 days builds foundation, 14 days supports a deeper reset, 28 days is the flagship immersion, and 60 days is an advanced residency. If you share your current season of life and travel window, the team can recommend the right depth during the suitability call."

## Health boundary template

"Thank you for sharing that. Shreevan Wellness is a wellness retreat, not medical care, therapy, diagnosis or emergency support. If this involves a medical condition, medication, pregnancy, injury or active mental-health concern, please consult a qualified professional before booking. The team can still discuss suitability and whether the retreat environment is appropriate, but we should not treat this as medical advice."

## Payment readiness template

"Payment should come after your booking context is confirmed. Before payment, the team should clarify program fit, dates, room expectations, food comfort, terms, refund policy and any health boundaries. If you already have an invoice or booking ID, use the payment verification page. If not, please start with consultation."

## Food and stay template

"Food and room comfort should be clarified before booking, especially for international guests or longer stays. Shreevan's food approach is vegetarian and sattvic, but dietary restrictions, allergies, spice comfort and room category need confirmation before payment."

## Travel template

"Shreevan Wellness is positioned in Rishikesh, Uttarakhand, India. The team can help with retreat logistics and arrival planning, but visa eligibility and immigration rules should be checked through official government sources. Share your country and rough arrival window so the team can guide the practical next steps."

## Follow-up schedule suggestion

Suggested CRM automation:

- Day 0: immediate acknowledgement.
- Day 1: if no reply, ask for missing context.
- Day 3: share program comparison and invite suitability call.
- Day 7: ask if travel window or program interest has changed.
- Day 14: close gently or mark for future nurture.

Do not use pressure or fake scarcity in follow-ups.` },
];

export interface PackEntry {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

/** Tag carried by every entry this pack manages, so the seeder can prune stale ones. */
export const PACK_TAG = 'pack:shreevan';

/**
 * Split each file into one entry per "## heading". Content before the first
 * "##" (the H1 + intro) is ignored. Titles are de-duplicated across files.
 */
export function chunkPack(): PackEntry[] {
  const out: PackEntry[] = [];
  const seen = new Set<string>();
  for (const file of SHREEVAN_PACK) {
    for (const sec of file.markdown.split(/\n(?=## )/g)) {
      const s = sec.trim();
      if (!s.startsWith('## ')) continue;
      const nl = s.indexOf('\n');
      const title = (nl === -1 ? s.slice(3) : s.slice(3, nl)).trim();
      const body = nl === -1 ? '' : s.slice(nl + 1).trim();
      if (!title || !body) continue;
      let key = title;
      if (seen.has(key)) key = `${title} (${file.category})`;
      seen.add(key);
      out.push({ title: key, content: body, category: file.category, tags: [PACK_TAG] });
    }
  }
  return out;
}
