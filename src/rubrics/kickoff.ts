/**
 * Kick-off call rubric, structured. Source of truth in prose:
 * exercise-reference/rubrics/kickoff-call-rubric.md - re-read that file if this
 * ever needs re-deriving; don't paraphrase from memory of this file.
 *
 * Mixed scoring: D1/D3/D5/D10/D12 give genuine min-max ranges; D2/D4/D6/D7/D8/D9/D11
 * give a single fixed value per level (encoded as min === max). stepSize follows
 * the rubric's own rule: 0.5 when a dimension's max <= 5, else 1.
 */

import type { RubricContract } from "@/types/rubric";

export const kickoffRubric: RubricContract = {
  callType: "kickoff",
  totalPoints: 100,
  scoreBands: [
    { name: "Elite", min: 90, max: 100 },
    { name: "Strong", min: 80, max: 89 },
    { name: "Inconsistent", min: 70, max: 79 },
    { name: "At Risk", min: 60, max: 69 },
    { name: "Fail", min: 0, max: 59 },
  ],
  automaticCaps: [
    {
      id: "no-follow-up-questions",
      condition: "No follow-up questions anywhere in the call",
      signal: "noFollowUpQuestionsAnywhere",
      firesWhenSignalIs: true,
      effect: { type: "maxTotal", value: 70 },
    },
    {
      id: "coach-dominates-no-engagement",
      condition: "Coach speaks >70% of the time without client engagement",
      signal: "coachDominatesWithoutEngagement",
      firesWhenSignalIs: true,
      effect: { type: "maxTotal", value: 80 },
    },
    {
      id: "unresolved-confusion",
      condition: "Client shows unresolved confusion at any point",
      signal: "clientUnresolvedConfusion",
      firesWhenSignalIs: true,
      effect: { type: "maxTotal", value: 75 },
    },
    {
      id: "no-north-star",
      condition: "No North Star statement constructed",
      signal: "noNorthStarStatement",
      firesWhenSignalIs: true,
      effect: { type: "maxDimension", dimensionId: "D4", value: 10 },
    },
  ],
  dimensions: [
    {
      id: "D1",
      name: "Pre-Call Preparation",
      maxScore: 10,
      stepSize: 1,
      whatToLookFor:
        "Does the coach demonstrate they reviewed the sales notes BEFORE the call? Do they reference the client's name, goals, injuries, and context without asking? Score on conduct, not disclosure - credit preparation when the coach demonstrably uses information that could only have come from sales notes, even without saying 'I read your notes.'",
      bands: [
        {
          label: "Elite",
          min: 9,
          max: 10,
          criteria:
            "Fully reviewed intake, references goals naturally, no repetition. References specific goals + name + injuries within first 2 minutes. Uses >=2 specific details from notes naturally. Score 10 when delivery is seamless and at least one verbal acknowledgement is present; 9 when otherwise elite without the verbal acknowledgement.",
        },
        {
          label: "Strong",
          min: 6,
          max: 8,
          criteria:
            "Clear evidence of preparation surfaced naturally, but with a small gap: a single factual misstep, slightly delayed reference, or one redundant question. Allowing the client to voluntarily share context for relational warmth is NOT a deduction. Score 8 when the gap is minor and clearly outweighed by solid prep; 6 when prep is real but uneven.",
        },
        {
          label: "Mid",
          min: 4,
          max: 5,
          criteria:
            "Partial preparation. Some notes used, but several redundant questions or a generic, low-personalization intro. Reads notes mechanically. Reserve for visibly thin prep, not solid-but-unannounced prep.",
        },
        {
          label: "Weak",
          min: 1,
          max: 3,
          criteria: "Minimal preparation visible. One or two surface references at most; client does most of the context-setting.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Clearly unprepared. Asks client their name or what brought them here. Completely resets the sale.",
        },
      ],
      positiveSignals: [
        "Specific goals/pain/history surfaced in the opening",
        "\"I saw from your notes that...\"",
        "\"[Salesperson] mentioned that...\"",
        "\"You don't need to repeat what you told the team...\"",
      ],
      negativeSignals: [
        "\"Can you tell me about yourself?\"",
        "\"What brought you here?\"",
        "Long pause while searching for information",
        "Multiple redundant logistics questions already covered in sales notes",
      ],
      calibrationNotes: [
        "Coach references specific goals + injuries from the sales call but does NOT say \"I read your notes\" -> Strong (7-8), not Mid. The conduct is the test, not the disclosure.",
        "Coach is otherwise well-prepared but makes one factual misstep (e.g. wrong city) -> Strong (6-7), not Mid.",
        "Coach lets the client share context voluntarily for relational warmth -> not a deduction.",
        "Do NOT default to Mid (4-5) simply because the coach did not say \"I read your notes.\"",
      ],
    },
    {
      id: "D2",
      name: "Rapport & Tone",
      maxScore: 10,
      stepSize: 1,
      whatToLookFor:
        "Does a genuine human connection form? Does the coach adapt their energy to the client? Does the client open up?",
      bands: [
        {
          label: "Elite",
          min: 10,
          max: 10,
          criteria:
            "Warm, calm, personalized, matches client energy. Conversation is natural and non-scripted. Uses client's name organically. Shares something personal and relevant. Client opens up spontaneously with personal stories.",
        },
        {
          label: "Strong",
          min: 7,
          max: 7,
          criteria: "Friendly but surface-level. Warm and conversational but not deeply personal. Good connection but little emotional mirroring or depth.",
        },
        {
          label: "Mid",
          min: 3,
          max: 3,
          criteria: "Mechanical / scripted feel. Friendly but transactional. Light conversation without real connection.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Cold, rushed, transactional. Skips rapport entirely. No attempt at personal connection. Client gives monosyllabic answers.",
        },
      ],
      positiveSignals: ["Client shares personal stories unprompted", "Natural laughter", "Client says \"I like that you...\""],
      negativeSignals: ["Awkward silences", "Monosyllabic client responses", "Coach talks about themselves excessively"],
    },
    {
      id: "D3",
      name: "Agenda Framing",
      maxScore: 5,
      stepSize: 0.5,
      whatToLookFor:
        "Does the coach take control of the call structure upfront and communicate what will happen? Numbered enumeration is NOT required - a sequenced delivery covering >=3 distinct phases, paired with explicit time framing and at least implicit client buy-in, qualifies as structured.",
      bands: [
        {
          label: "Elite",
          min: 4.5,
          max: 5,
          criteria:
            "Clear agenda with explicit time framing AND >=3 sequenced phases (numbered or natural-language) AND client verbal consent (\"sounds good\"). Score 5 when all three elements are crisp; 4.5 when fully present and sequenced but slightly informal.",
        },
        {
          label: "Mid",
          min: 2.5,
          max: 3.5,
          criteria:
            "Agenda mentioned but partial - either time framing missing, fewer than 3 phases, or no client buy-in. Implicit structure rather than intentional framing.",
        },
        {
          label: "Weak",
          min: 1,
          max: 2,
          criteria: "Brief or fragmented mention of what's coming, without sequencing or framing.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "No upfront structure. Launches into random topics. Client has no sense of where the call is going.",
        },
      ],
      positiveSignals: [
        "Time stated (\"we've got 30 minutes\")",
        "Sequenced coverage (\"connect, get aligned on your goals, walk you through the journey, support, schedule next\")",
        "Client confirms (\"sounds good\")",
      ],
      negativeSignals: [
        "Starts with random questions",
        "Client doesn't know where the call is going",
        "No time stated",
        "Single vague mention without sequencing",
      ],
      calibrationNotes: [
        "A coach who says \"we've got 30 minutes - connect, get aligned on your goals, what success looks like, walk you through the journey, get clear on support, and schedule the next call\" is delivering Elite-level agenda framing even without numbered enumeration. Score 4.5-5, not 3.",
      ],
    },
    {
      id: "D4",
      name: "Goal Alignment & Deep Why",
      maxScore: 15,
      stepSize: 1,
      whatToLookFor:
        "Does the coach go beyond functional goals to uncover the emotional/identity driver? Is a North Star statement built? Auto-cap: no North Star statement anywhere in the call -> max 10 regardless of the rest of this scoring.",
      bands: [
        {
          label: "Elite",
          min: 15,
          max: 15,
          criteria:
            "Extracts emotional drivers + clear 30-day success metrics. >=2 follow-up questions on \"why\". Extracts emotional/identity driver (fear, family, legacy, career, self-image). Builds a North Star statement. Defines specific 30-day success metric. Client verbally confirms (\"Yes, that's exactly it\").",
        },
        {
          label: "Strong",
          min: 10,
          max: 10,
          criteria:
            "Understands goals but stays surface level. 1 follow-up + some emotional context. 30-day goal vague or not established. North Star implied but not solidified. Physical goals identified, not emotionally deep.",
        },
        {
          label: "Mid",
          min: 5,
          max: 5,
          criteria: "Mostly repeats sales notes. Asks \"what are your goals?\" and accepts the first answer. Stays physical only. No probing, no emotional depth, no North Star.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "No meaningful alignment. Reads from sales notes without engagement. Skips or rushes. Accepts a generic answer and moves on.",
        },
      ],
      positiveSignals: [
        "\"Why is that important to you?\"",
        "\"How would that impact your life?\"",
        "\"What would happen if nothing changes?\"",
        "\"What I hear you saying is...\"",
        "\"What would make day 30 feel like the best investment you've ever made?\"",
      ],
      negativeSignals: ["Accepts \"I want to be healthy\" without digging", "Stays only on physical", "Never references the goal later in the call"],
      calibrationNotes: [
        "#1 loss dimension: most coaches stay surface on the \"why\" - they visit the goal but never strengthen the connection to the North Star.",
      ],
    },
    {
      id: "D5",
      name: "Program Explanation (3 Phases)",
      maxScore: 10,
      stepSize: 1,
      whatToLookFor:
        "Does the client leave understanding the 3-phase structure and why it exists? Canon: (1) Movement Retraining (2) Movement Remodeling (3) Movement Integrating. Accept ANY phrasing that conveys the three-stage progression in correct order (e.g. Reset/Baseline -> Build/Strength -> Freedom/Mastery). Do NOT penalize canonical naming.",
      bands: [
        {
          label: "Elite",
          min: 9,
          max: 10,
          criteria:
            "All 3 phases clearly named (any equivalent phrasing) with outcomes for each. Uses an analogy (pyramid, mountain, ladder) or reassessment cadence (week 4, 8, 12, 16). Each phase tied to the client's specific goal. High belief transfer.",
        },
        {
          label: "Strong",
          min: 6,
          max: 8,
          criteria:
            "All 3 phases clearly identified in correct order (any naming), but delivery is simple or moderately generic. Phases may not be deeply tied to goals, OR analogy/cadence is missing, OR the coach doesn't check understanding. Score 8 when crisp+complete; 6 when present but brief.",
        },
        {
          label: "Mid",
          min: 3,
          max: 5,
          criteria: "Fragmented explanation. 1-2 phases mentioned vaguely, or progression implied but not laid out in sequence.",
        },
        {
          label: "Weak",
          min: 1,
          max: 2,
          criteria: "Only references to \"phases\"/\"steps\" without naming or sequencing.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Skips or misrepresents. No phase explanation at all. Just \"we'll do mobility exercises.\"",
        },
      ],
      positiveSignals: [
        "\"Movement Retraining -> Remodeling -> Integrating\" (or equivalent, correct order)",
        "Analogies (mountain, pyramid, ladder)",
        "Reassessment cadence stated",
        "Phases linked to client's specific goal",
        "Coach asks client if it makes sense",
      ],
      negativeSignals: ["\"We'll do a bit of everything\"", "No progression described", "Phases named but not in correct sequence", "No tie to client goals"],
      calibrationNotes: [
        "When a coach uses \"Movement Retraining -> Remodeling -> Integrating\" - that is the correct Halden Method naming. Credit as Elite-tier phase identification. Do NOT drop the score because the labels don't say \"Reset/Build/Freedom\".",
      ],
    },
    {
      id: "D6",
      name: "Journey & Expectation Setting",
      maxScore: 10,
      stepSize: 1,
      whatToLookFor: "Does the coach prepare the client emotionally for the difficulty of the journey?",
      bands: [
        {
          label: "Elite",
          min: 10,
          max: 10,
          criteria:
            "Clearly explains milestones, timeline, challenges. Normalizes emotional friction explicitly (\"there will be a week where you feel like you're not progressing - that's normal\"). Explains valleys (weeks 3-4). Distinguishes good discomfort from bad pain. Explains the first month is foundational, not transformational. Links back to North Star.",
        },
        {
          label: "Strong",
          min: 7,
          max: 7,
          criteria: "Covers basics but misses emotional prep. Timeline explained, structure ok. Normalizes physical discomfort but not emotional. Missing psychological preparation for valleys.",
        },
        {
          label: "Mid",
          min: 3,
          max: 3,
          criteria: "Vague expectations. Informative but not experiential. Explains what will happen but not how it will feel. Sounds instructional, not coaching.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "No expectation setting. Leaves client with unrealistic expectations. Doesn't mention there will be hard moments.",
        },
      ],
      positiveSignals: [
        "\"Around week 3-4 you might feel in a valley\"",
        "\"First month: foundational, not transformational\"",
        "\"It's normal to feel overwhelmed - I want you to reach out when that happens.\"",
      ],
      negativeSignals: ["Only positivity, no mention of difficulty", "No normalization of struggle"],
      calibrationNotes: [
        "#2 loss dimension: most coaches explain the timeline but never normalize emotional friction. Clients hit week 3-4 unprepared and disengage.",
      ],
    },
    {
      id: "D7",
      name: "Support System Clarity",
      maxScore: 5,
      stepSize: 0.5,
      whatToLookFor:
        "Does the coach communicate, in this call, exactly how the client will be supported between sessions - primary channel, response expectations, community access, and how accountability will work? Scores what is said in the call; training-app message history is not required.",
      bands: [
        {
          label: "Elite",
          min: 5,
          max: 5,
          criteria:
            "Clearly explains all channels + when to use each. Primary channel named explicitly. Response time stated. Community platform/community access mentioned. Accountability style asked or framed. Client visibly understands how to reach the coach and what to expect.",
        },
        {
          label: "Mid",
          min: 3,
          max: 3,
          criteria: "Mentions support but unclear usage. Channel mentioned but no response times. Vague \"reach out anytime\" without structure. No accountability framing.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Not explained. No mention of how the client reaches the coach between sessions. No channel named. No response expectations.",
        },
      ],
      positiveSignals: [
        "\"the training app is our main channel\"",
        "\"I respond within 24h\"",
        "\"the community platform community is where the cohort lives\"",
        "\"Do you want me to push you or stay back?\"",
      ],
      negativeSignals: ["No mention of the training app", "Generic \"reach out anytime\" without structure", "No response-time expectations", "No accountability framing"],
    },
    {
      id: "D8",
      name: "Coaching Intelligence Questions",
      maxScore: 10,
      stepSize: 1,
      whatToLookFor: "Does the coach gather information that goes beyond logistics into behavioral patterns, psychology, and personalization?",
      bands: [
        {
          label: "Elite",
          min: 10,
          max: 10,
          criteria:
            "Asks key behavioral + self-awareness questions: behavioral patterns, consistency triggers, learning style, stress response. Uses answers to personalize. Identifies client archetype signals (Doer/Controller/Worrier/Follower).",
        },
        {
          label: "Strong",
          min: 7,
          max: 7,
          criteria: "Asks 1-2 but lacks depth. Asks about pain triggers, schedule, training style. Missing behavioral pattern or mindset questions. Doesn't use answers to adapt approach.",
        },
        {
          label: "Mid",
          min: 3,
          max: 3,
          criteria: "Generic questions only. Basic (frequency, equipment, availability). Surface-level coaching. Doesn't use answers to adapt.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Skipped. No coaching intelligence questions. Only \"when are you available?\" / \"do you have equipment?\". Client not truly known.",
        },
      ],
      positiveSignals: [
        "\"What has stopped you before?\"",
        "\"How do you respond when you're overwhelmed?\"",
        "\"Do you prefer I push you or support gently?\"",
        "\"What usually makes you quit a program?\"",
      ],
      negativeSignals: ["Only logistical questions", "No psychological or behavioral inquiry", "Doesn't use responses"],
      calibrationNotes: [
        "Archetype detection: Doer = confident, data-driven, wants \"the how\". Controller = pushes back, questions the process, needs proof. Worrier = seeks reassurance, doubts themselves, asks \"what if\". Follower = enthusiastic but vague goals, history of not following through.",
      ],
    },
    {
      id: "D9",
      name: "Next Steps & Diagnostics",
      maxScore: 10,
      stepSize: 1,
      whatToLookFor: "Does the client leave knowing exactly what to do and when?",
      bands: [
        {
          label: "Elite",
          min: 10,
          max: 10,
          criteria:
            "Clear, confident, client understands exactly what to do. Pipeline: diagnostics -> film -> upload -> program -> start date. Explains how to film (angle, device). Removes confusion with demo/screen share. Time specified. Client verbally confirms understanding.",
        },
        {
          label: "Strong",
          min: 7,
          max: 7,
          criteria: "Some clarity but minor confusion. Clear instructions but no demo. Timeline ok but slightly rushed. Minor ambiguity but overall strong clarity.",
        },
        {
          label: "Mid",
          min: 3,
          max: 3,
          criteria: "Vague instructions. Partially clear, some gaps. Client has unresolved doubts. No specific timeline.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "No clear next steps. \"I'll send you some stuff\" without explanation. Client doesn't know what to do after the call. No structure.",
        },
      ],
      positiveSignals: [
        "\"Here's what you do: open the training app, find diagnostics, film, upload\"",
        "\"Send by Saturday, you'll have your program by Monday\"",
        "Screen share of apps",
      ],
      negativeSignals: ["\"I'll email you something\"", "Client asks \"So what do I do now?\"", "No timeline"],
      calibrationNotes: [
        "#3 loss dimension: \"I'll send you some stuff\" is the most expensive sentence in coaching. Vague next steps lose clients in the hand-off.",
      ],
    },
    {
      id: "D10",
      name: "Booking Next Call",
      maxScore: 5,
      stepSize: 0.5,
      whatToLookFor:
        "Is the next call booked LIVE before the call ends? Booking is verbal, not technical - the substantive test is verbal confirmation of date and time during the call. Whether the calendar invite is technically clicked on-screen during the call vs immediately after is a recording artifact, not a deduction.",
      bands: [
        {
          label: "Elite",
          min: 4.5,
          max: 5,
          criteria:
            "Date and time confirmed verbally during the call. Coach navigates scheduling constraints live (time zones, availability, conflicts). Score 5 when crisp and proactively closed; 4.5 when confirmed but slightly rushed/minor ambiguity.",
        },
        {
          label: "Mid",
          min: 2.5,
          max: 3.5,
          criteria: "Attempted but not fully secured. Coach raises booking but leaves excessive flexibility (\"I'll send you a link\") rather than locking date+time live.",
        },
        {
          label: "Weak",
          min: 1,
          max: 2,
          criteria: "Booking referenced only in passing, no concrete attempt to lock it during the call.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Not addressed. Call ends without any mention of the next call.",
        },
      ],
      positiveSignals: [
        "\"Let's book it now before we close\"",
        "Specific date+time confirmed verbally",
        "Resolves scheduling conflict live",
        "\"I've just sent your invite for...\"",
      ],
      negativeSignals: ["\"I'll send you the link\"", "Call closed without booking", "\"We'll figure it out via message.\""],
      calibrationNotes: [
        "If date and time are confirmed verbally and any time-zone/scheduling friction is resolved live, score 5/5 - even if the transcript does not explicitly confirm the calendar invite was sent during the recording.",
      ],
    },
    {
      id: "D11",
      name: "Close, Recap & Confidence",
      maxScore: 5,
      stepSize: 0.5,
      whatToLookFor: "Does the call end with energy, structure, and an emotional anchor - not just logistics?",
      bands: [
        {
          label: "Elite",
          min: 5,
          max: 5,
          criteria:
            "Strong recap, reinforces confidence. Structured recap (\"Here's what we covered today: X, Y, Z\"). Confidence anchor (\"You're in the right place\"). Emotional reinforcement. Does NOT end with only logistics.",
        },
        {
          label: "Mid",
          min: 3,
          max: 3,
          criteria: "Basic close. Positive close but no structured recap. Generic encouragement without emotional anchor. Ends with next steps logistically, or flat close: \"Ok, talk soon.\"",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "Abrupt or unclear ending. Call ends in a disappointing or flat way. Client leaves without feeling excited.",
        },
      ],
      positiveSignals: ["\"Here's what we covered...\"", "\"You're in exactly the right place\"", "\"I'm excited about this journey with you.\""],
      negativeSignals: ["\"Ok, speak next time\"", "No summary", "Flat or cold tone"],
      calibrationNotes: [
        "Missing structured recap is the most universal gap across all coaches - even elite calls typically score 3-4/5 here. Cap: no structured recap -> max 3.",
      ],
    },
    {
      id: "D12",
      name: "Post-Call Execution",
      maxScore: 5,
      stepSize: 0.5,
      whatToLookFor:
        "Does the coach commit, in-call, to specific post-call deliverables with concrete deadlines? Scores what is said in the call - verification of actual delivery is out of scope. Informal commitments still count: a specific commitment with implied/rough timing is a real promise, score Mid not Fail. Reserve Fail for no commitment at all.",
      bands: [
        {
          label: "Elite",
          min: 4.5,
          max: 5,
          criteria:
            "Multiple explicit post-call commitments with precise deadlines: recap timing, diagnostics assigned live, program delivery date stated. All time-bound. Score 5 when 3+ commitments crisp; 4.5 when 2+ commitments precise.",
        },
        {
          label: "Strong",
          min: 3.5,
          max: 4,
          criteria: "Two or more post-call commitments with mostly precise timing - minor gaps (one rougher, or one specific + one general).",
        },
        {
          label: "Mid",
          min: 2,
          max: 3,
          criteria:
            "At least one specific commitment, but timing is rough or only one/two commitments made. Includes informal-but-real commitments (\"I'll get diagnostics done over the weekend\"). Partial promise hygiene.",
        },
        {
          label: "Weak",
          min: 1,
          max: 1,
          criteria: "Vague reference to follow-up (\"I'll send you stuff\") without specific deliverable or timing.",
        },
        {
          label: "Fail",
          min: 0,
          max: 0,
          criteria: "No post-call commitments stated at all. Call ends with no clarity on what the coach will do next.",
        },
      ],
      positiveSignals: [
        "\"I'll send you the recap in the next 10-15 minutes\"",
        "\"I'm assigning diagnostics now\"",
        "\"Your program will be ready by Monday\"",
        "Specific or implied timing on every commitment",
        "Concrete deliverable named",
      ],
      negativeSignals: ["No mention of follow-up actions", "\"I'll send you stuff\" without specifics", "No timing on any commitment", "No concrete deliverable named"],
      calibrationNotes: [
        "A commitment like \"I'll get the diagnostics done over the weekend\" is real but soft - score it as Mid (2-3), not Fail (0).",
      ],
    },
  ],
};
